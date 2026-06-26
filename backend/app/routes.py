import logging
import threading as _threading_mod
import requests
from urllib.parse import urlparse
logger = logging.getLogger(__name__)

# Cap concurrent DDGS calls to 3 — prevents DuckDuckGo rate-limiting during bulk autofill
_DDGS_SEM = _threading_mod.Semaphore(3)
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import Response, RedirectResponse
import base64
import secrets
import re as _re
from typing import Optional
import os
import posthog
from .models import (
    LeadCreate, LeadUpdate, CompanyCreate, CompanyUpdate,
    UserSignup, UserLogin, PasswordResetRequest, PasswordResetConfirm,
    ICPCreate, ICPUpdate, PersonaCreate, PersonaUpdate,
    LeadStarUpdate, LeadConnectionStatusUpdate, LeadSpreadsheetUpdate,
)
from .database import supabase, supabase_auth
from .rate_limit import limiter
from .security import (
    validate_uuid,
    log_auth_success, log_auth_failure, log_signup,
    log_password_reset_request, log_password_reset_success,
    log_token_refresh, log_bulk_op, log_suspicious,
    validate_external_url, verify_cron_auth, sanitize_text,
)

router = APIRouter()


def _ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For from ALB/Nginx."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "?"

# ─── AUTH ROUTES ────────────────────────────────────────────

@router.post("/auth/signup")
@limiter.limit("3/minute")
async def signup(request: Request, user: UserSignup):
    try:
        response = supabase_auth.auth.sign_up({
            "email": user.email,
            "password": user.password,
        })
        if response.user:
            try:
                supabase.table("profiles").insert({
                    "id": response.user.id,
                    "email": user.email,
                    "full_name": user.full_name or "",
                }).execute()
            except Exception:
                pass  # profile creation is non-fatal; auth record already exists
            log_signup(user_id=response.user.id, ip=_ip(request))
            posthog.identify(response.user.id, {"has_full_name": bool(user.full_name)})
            posthog.capture(response.user.id, "user_signed_up", {"signup_method": "email"})
        # Always return the same message to prevent email enumeration
        return {"message": "If this email is not already registered, you will receive a confirmation link shortly."}
    except Exception:
        # Never expose internal Supabase errors to the client
        raise HTTPException(status_code=400, detail="Registration failed. Please check your details and try again.")


@router.post("/auth/ensure-profile")
async def ensure_profile(request: Request, authorization: str = Header(...)):
    """Idempotent profile upsert for OAuth sign-ins (Google, LinkedIn) that bypass /auth/signup."""
    user_id = get_user_id(authorization)
    body = await request.json()
    email     = (body.get("email")     or "").strip()
    full_name = (body.get("full_name") or "").strip()
    res = supabase.table("profiles").select("id").eq("id", user_id).limit(1).execute()
    if res.data:
        return {"status": "exists"}
    try:
        supabase.table("profiles").insert({
            "id": user_id,
            "email": email,
            "full_name": full_name,
        }).execute()
        posthog.identify(user_id, {"email": email, "has_full_name": bool(full_name)})
        posthog.capture(user_id, "user_signed_up", {"signup_method": "oauth"})
    except Exception:
        pass
    return {"status": "created"}


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, user: UserLogin):
    try:
        response = supabase_auth.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
    except Exception:
        log_auth_failure(email=user.email, ip=_ip(request), reason="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Enforce email verification — unconfirmed users cannot access the platform
    if not response.user.email_confirmed_at:
        log_auth_failure(email=user.email, ip=_ip(request), reason="email_not_verified")
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please check your inbox and click the confirmation link before logging in.",
        )

    log_auth_success(user_id=response.user.id, ip=_ip(request))
    posthog.identify(response.user.id, {})
    posthog.capture(response.user.id, "user_logged_in", {"login_method": "password"})

    return {
        "access_token":  response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "user": {
            "id":    response.user.id,
            "email": response.user.email,
        },
    }


@router.post("/auth/refresh")
@limiter.limit("30/minute")
async def refresh_token(request: Request, payload: dict):
    try:
        response = supabase_auth.auth.refresh_session(payload.get("refresh_token", ""))
        return {
            "access_token":  response.session.access_token,
            "refresh_token": response.session.refresh_token,
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")


@router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, payload: PasswordResetRequest):
    redirect_url = os.getenv("PASSWORD_RESET_REDIRECT_URL", "https://sonarleads.vercel.app/reset-password")
    log_password_reset_request(email=payload.email, ip=_ip(request))
    try:
        supabase_auth.auth.reset_password_for_email(
            payload.email,
            {"redirect_to": redirect_url},
        )
    except Exception:
        pass  # always succeed to prevent email enumeration
    return {"message": "If that email is registered, a password reset link has been sent."}


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, payload: PasswordResetConfirm):
    # Verify the recovery token by fetching the user it belongs to
    try:
        user_resp = supabase_auth.auth.get_user(payload.recovery_token)
        user_id   = user_resp.user.id
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link. Please request a new one.")

    # Update password using the service-role admin client (bypasses session requirement)
    try:
        supabase.auth.admin.update_user_by_id(user_id, {"password": payload.new_password})
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update password. Please try again.")

    log_password_reset_success(user_id=user_id, ip=_ip(request))
    return {"message": "Password updated successfully. You can now log in."}


# ─── HELPER: get user id from token ─────────────────────────

def get_user_id(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "").strip()
        if not token:
            raise ValueError("Missing token")
        user = supabase_auth.auth.get_user(token)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _first(res) -> dict | None:
    """Return the first row from a Supabase limit(1) query, or None.
    Replaces .maybe_single()/.single() which raise 406 on 0 rows in supabase-py 2.x."""
    return res.data[0] if res.data else None


def _check_user_rate_limit(user_id: str, endpoint: str, limit: int, window_minutes: int = 60) -> None:
    """Raise 429 if user has exceeded `limit` calls to `endpoint` in the past `window_minutes`.
    Non-blocking: DB errors are silently swallowed so a Supabase hiccup never blocks a real request."""
    import datetime as _rl_dt
    since = (_rl_dt.datetime.now(_rl_dt.timezone.utc) - _rl_dt.timedelta(minutes=window_minutes)).isoformat()
    try:
        res = supabase.table("rate_limit_log").select("id", count="exact").eq("user_id", user_id).eq("endpoint", endpoint).gte("called_at", since).execute()
        if (res.count or 0) >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit reached — max {limit} calls per {window_minutes} minutes for this operation. Please wait and try again."
            )
        supabase.table("rate_limit_log").insert({"user_id": user_id, "endpoint": endpoint}).execute()
    except HTTPException:
        raise
    except Exception:
        pass  # Allow through if the rate-limit table is unavailable


# ─── LEADS ROUTES ────────────────────────────────────────────

@router.get("/leads")
async def get_leads(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("leads")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"leads": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/check-urls")
async def check_urls_batch(payload: dict, authorization: str = Header(...)):
    """Batch check multiple LinkedIn URLs — returns pipeline status for each. Used by Chrome extension search overlay."""
    user_id = get_user_id(authorization)
    urls = payload.get("urls", [])
    if not urls or len(urls) > 50:
        raise HTTPException(status_code=400, detail="1-50 URLs required")
    results = {}
    for url in urls:
        clean = url.split('?')[0].split('#')[0].rstrip('/')
        res = supabase.table("leads")\
            .select("id, name, title, company, stage, icp_score, email")\
            .eq("user_id", user_id)\
            .or_(f"profile_url.eq.{clean},profile_url.eq.{clean}/")\
            .limit(1).execute()
        results[url] = {"found": bool(res.data), "lead": res.data[0] if res.data else None}
    return {"results": results}


@router.get("/leads/hot")
async def get_hot_leads(authorization: str = Header(...)):
    """Return top 5 leads by engagement score for the dashboard hot leads widget."""
    user_id = get_user_id(authorization)
    res = supabase.table("leads").select("id,name,email,company,title,engagement_score,last_engaged_at").eq("user_id", user_id).gt("engagement_score", 0).order("engagement_score", desc=True).limit(5).execute()
    return {"leads": res.data or []}


@router.get("/leads/by-profile-url")
async def get_lead_by_profile_url(url: str, authorization: str = Header(...)):
    """Used by the Chrome extension to check if a LinkedIn profile is already a lead."""
    user_id = get_user_id(authorization)
    try:
        clean = url.split('?')[0].split('#')[0].rstrip('/')
        variants = [clean, clean + "/"]
        lead_row = None
        for variant in variants:
            res = supabase.table("leads")\
                .select("id, name, title, company, stage, email_score, email_status, icp_score")\
                .eq("user_id", user_id)\
                .eq("profile_url", variant)\
                .limit(1)\
                .execute()
            if res.data:
                lead_row = res.data[0]
                break
        if not lead_row:
            return {"lead": None}
        # Check active sequence enrollments
        enroll_res = supabase.table("sequence_enrollments")\
            .select("id, status, sequence_id")\
            .eq("user_id", user_id)\
            .eq("lead_id", lead_row["id"])\
            .in_("status", ["active", "paused"])\
            .limit(1)\
            .execute()
        lead_row["in_sequence"] = len(enroll_res.data) > 0
        return {"lead": lead_row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leads/by-email")
async def get_lead_by_email(email: str, authorization: str = Header(...)):
    """Used by the Gmail sidebar to look up a lead by sender email."""
    user_id = get_user_id(authorization)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    try:
        res = supabase.table("leads")\
            .select("id, name, title, company, location, email, email_provider, stage, icp_score, icp_score_reason, email_score, email_status, profile_url, starred, status, connection_status")\
            .eq("user_id", user_id)\
            .ilike("email", email.strip())\
            .limit(1)\
            .execute()
        if not res.data:
            return {"lead": None}
        lead_row = res.data[0]
        enroll_res = supabase.table("sequence_enrollments")\
            .select("id, status, sequence_id, sequences(name)")\
            .eq("user_id", user_id)\
            .eq("lead_id", lead_row["id"])\
            .in_("status", ["active", "paused"])\
            .limit(5)\
            .execute()
        lead_row["enrollments"] = enroll_res.data or []
        activity_res = supabase.table("activities")\
            .select("type, created_at, note")\
            .eq("lead_id", lead_row["id"])\
            .order("created_at", desc=True)\
            .limit(5)\
            .execute()
        lead_row["recent_activity"] = activity_res.data or []
        return {"lead": lead_row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads")
async def create_lead(lead: LeadCreate, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        data = lead.dict()
        data["user_id"] = user_id
        if data.get("scraped_at"):
            data["scraped_at"] = data["scraped_at"].isoformat()

        # Avoid duplicate leads by profile_url
        if data.get("profile_url"):
            existing = supabase.table("leads")\
                .select("id")\
                .eq("user_id", user_id)\
                .eq("profile_url", data["profile_url"])\
                .execute()
            if existing.data:
                raise HTTPException(status_code=409, detail="Lead already exists")

        response = supabase.table("leads").insert(data).execute()
        posthog.capture(user_id, "lead_created", {
            "has_email": bool(data.get("email")),
            "has_company": bool(data.get("company")),
        })
        inserted = response.data[0] if response.data else {}
        _fire_webhooks(user_id, "lead.created", {"id": inserted.get("id"), "name": inserted.get("name"), "email": inserted.get("email"), "company": inserted.get("company")})
        return {"lead": inserted}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"COMPLIANCE ERROR: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    lead: LeadUpdate,
    authorization: str = Header(...)
):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        data = {k: v for k, v in lead.dict().items() if v is not None}
        response = supabase.table("leads")\
            .update(data)\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"lead": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, authorization: str = Header(...)):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        supabase.table("leads")\
            .delete()\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
        posthog.capture(user_id, "lead_deleted")
        return {"message": "Lead deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/bulk-delete")
async def bulk_delete_leads(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="ids required")
    ids = [i for i in ids if isinstance(i, str) and len(i) == 36]
    if not ids:
        raise HTTPException(status_code=400, detail="No valid IDs")
    try:
        supabase.table("leads")\
            .delete()\
            .in_("id", ids)\
            .eq("user_id", user_id)\
            .execute()
        posthog.capture(user_id, "leads_bulk_deleted", {"count": len(ids)})
        return {"deleted": len(ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/bulk-score")
async def bulk_score_leads_selected(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="ids required")
    ids = [i for i in ids if isinstance(i, str) and len(i) == 36][:50]

    profiles = supabase.table("icp_profiles").select("*").eq("user_id", user_id).execute()
    icp_list = profiles.data or []
    if not icp_list:
        raise HTTPException(status_code=400, detail="No ICP profiles defined")
    icp_text = "\n".join([f"- {p.get('title','')}: {p.get('description','')}" for p in icp_list])

    leads_res = supabase.table("leads").select("id,name,title,company,location,about")\
        .in_("id", ids).eq("user_id", user_id).execute()
    leads_data = leads_res.data or []

    results = []
    for lead in leads_data:
        try:
            prompt = f"""Rate this B2B lead against the ICP on a scale of 0-100.

ICP:
{icp_text}

Lead:
- Name: {lead.get('name','')}
- Title: {lead.get('title','')}
- Company: {lead.get('company','')}
- Location: {lead.get('location','')}
- About: {(lead.get('about') or '')[:300]}

Reply with JSON only: {{"score": <0-100>, "reason": "<one sentence>"}}"""
            raw = _call_ai(prompt, max_tokens=120, user_id=user_id, feature="bulk_icp_score")
            import json as _json, re as _re
            m = _re.search(r'\{.*\}', raw, _re.DOTALL)
            if m:
                parsed = _json.loads(m.group())
                score = max(0, min(100, int(parsed.get("score", 0))))
                reason = parsed.get("reason", "")
                supabase.table("leads").update({"icp_score": score, "icp_score_reason": reason})\
                    .eq("id", lead["id"]).eq("user_id", user_id).execute()
                results.append({"id": lead["id"], "score": score, "reason": reason})
        except Exception:
            pass

    return {"scored": len(results), "results": results}


@router.post("/leads/bulk-enrich")
async def bulk_enrich_emails_selected(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="ids required")
    ids = [i for i in ids if isinstance(i, str) and len(i) == 36][:30]

    leads_res = supabase.table("leads").select("id,name,email,company,website")\
        .in_("id", ids).eq("user_id", user_id).execute()
    leads_data = [l for l in (leads_res.data or []) if not l.get("email")]

    from .enrichment import waterfall_find_email, extract_domain

    enriched = 0
    results  = []
    for lead in leads_data:
        name    = lead.get("name", "")
        company = lead.get("company", "")
        website = lead.get("website", "")
        if not name:
            continue
        try:
            domain = extract_domain(website) if website else ""
            if not domain and company:
                co_res = supabase.table("companies").select("website")\
                    .eq("user_id", user_id).ilike("name", company).limit(1).execute()
                if co_res.data and co_res.data[0].get("website"):
                    domain = extract_domain(co_res.data[0]["website"])
            hit = waterfall_find_email(name, company=company, domain=domain)
            if hit.get("email"):
                upd = {"email": hit["email"],
                       "email_provider": hit.get("email_provider"),
                       "email_score":    hit.get("email_score")}
                supabase.table("leads").update(upd).eq("id", lead["id"]).eq("user_id", user_id).execute()
                enriched += 1
                results.append({"id": lead["id"], **upd})
        except Exception:
            pass

    return {"enriched": enriched, "attempted": len(leads_data), "results": results}


# ─── COMPANIES ROUTES ────────────────────────────────────────

@router.get("/companies")
async def get_companies(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("companies")\
            .select("*,is_saas,industry,specialties")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"companies": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/companies")
async def create_company(
    company: CompanyCreate,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    try:
        data = company.dict()
        data["user_id"] = user_id
        response = supabase.table("companies").insert(data).execute()
        posthog.capture(user_id, "company_created", {
            "has_website": bool(data.get("website")),
            "has_industry": bool(data.get("industry")),
        })
        return {"company": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── ICP ROUTES ──────────────────────────────────────────────

@router.get("/icp")
async def get_icp_profiles(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("icp_profiles")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"profiles": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/icp")
async def create_icp_profile(
    profile: ICPCreate,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    try:
        data = profile.dict()
        data["user_id"] = user_id
        response = supabase.table("icp_profiles").insert(data).execute()
        posthog.capture(user_id, "icp_profile_created")
        return {"profile": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/icp/{profile_id}")
async def update_icp_profile(
    profile_id: str,
    profile: ICPUpdate,
    authorization: str = Header(...)
):
    validate_uuid(profile_id, "profile_id")
    user_id = get_user_id(authorization)
    try:
        data = {k: v for k, v in profile.dict().items() if v is not None}
        response = supabase.table("icp_profiles")\
            .update(data)\
            .eq("id", profile_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"profile": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/icp/{profile_id}")
async def delete_icp_profile(
    profile_id: str,
    authorization: str = Header(...)
):
    validate_uuid(profile_id, "profile_id")
    user_id = get_user_id(authorization)
    try:
        supabase.table("icp_profiles")\
            .delete()\
            .eq("id", profile_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"message": "ICP profile deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── PERSONA ROUTES ──────────────────────────────────────────

@router.get("/personas")
async def get_personas(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("personas")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"personas": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/personas")
async def create_persona(
    persona: PersonaCreate,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    try:
        data = persona.dict()
        data["user_id"] = user_id
        response = supabase.table("personas").insert(data).execute()
        return {"persona": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/personas/{persona_id}")
async def delete_persona(
    persona_id: str,
    authorization: str = Header(...)
):
    validate_uuid(persona_id, "persona_id")
    user_id = get_user_id(authorization)
    try:
        supabase.table("personas")\
            .delete()\
            .eq("id", persona_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"message": "Persona deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── ENRICHMENT ROUTES ───────────────────────────────────────

@router.post("/leads/{lead_id}/enrich")
async def enrich_lead_route(
    lead_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        lead_res = supabase.table("leads")\
            .select("*")\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()

        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")

        lead = lead_res.data[0]

        if lead.get("email"):
            return {"lead": lead, "enriched": False, "message": "Email already exists"}

        from .enrichment import waterfall_find_email, extract_domain

        name    = lead.get("name", "")
        company = lead.get("company", "")
        website = lead.get("website", "")

        if not website and company:
            try:
                co_res = supabase.table("companies").select("website")\
                    .eq("user_id", user_id).ilike("name", company).limit(1).execute()
                if co_res.data and co_res.data[0].get("website"):
                    website = co_res.data[0]["website"]
            except Exception:
                pass

        domain = extract_domain(website) if website else ""
        result = waterfall_find_email(name, company=company, domain=domain)

        if result.get("email"):
            upd = {"email": result["email"],
                   "email_provider": result.get("email_provider"),
                   "email_score":    result.get("email_score")}
            supabase.table("leads").update(upd).eq("id", lead_id).eq("user_id", user_id).execute()
            provider = result.get("email_provider", "unknown")
            posthog.capture(user_id, "lead_enriched", {"source": provider, "success": True})
            return {"lead": {**lead, **upd}, "enriched": True,
                    "message": f"Email found via {provider}", "provider": provider}

        posthog.capture(user_id, "lead_enriched", {"source": "waterfall", "success": False})
        return {"lead": lead, "enriched": False,
                "message": "Email not found across all providers. Try adding the company website first."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/leads/enrich/bulk")
async def bulk_enrich_leads(
    payload: dict,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    lead_ids = payload.get("lead_ids", [])

    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")

    from .enrichment import enrich_lead
    enriched_count = 0
    skipped_count = 0

    for lead_id in lead_ids:
        try:
            lead_res = supabase.table("leads")\
                .select("*")\
                .eq("id", lead_id)\
                .eq("user_id", user_id)\
                .execute()

            if not lead_res.data:
                skipped_count += 1
                continue

            lead = lead_res.data[0]

            if lead.get("email"):
                skipped_count += 1
                continue

            enriched = enrich_lead(
                name=lead.get("name", ""),
                company=lead.get("company", ""),
            )

            if enriched.get("email"):
                supabase.table("leads")\
                    .update({"email": enriched["email"]})\
                    .eq("id", lead_id)\
                    .eq("user_id", user_id)\
                    .execute()
                enriched_count += 1
            else:
                skipped_count += 1

        except Exception:
            skipped_count += 1
            continue

    posthog.capture(user_id, "leads_bulk_enriched", {
        "enriched": enriched_count,
        "skipped": skipped_count,
        "total": len(lead_ids),
    })
    return {
        "enriched": enriched_count,
        "skipped": skipped_count,
        "total": len(lead_ids)
    }

# ─── STAR / UNSTAR LEAD ──────────────────────────────────────

@router.patch("/leads/{lead_id}/star")
async def star_lead(
    lead_id: str,
    data: LeadStarUpdate,
    authorization: str = Header(...)
):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("leads")\
            .update({"starred": data.starred})\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"lead": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── CONNECTION STATUS ────────────────────────────────────────

@router.patch("/leads/{lead_id}/connection-status")
async def update_connection_status(
    lead_id: str,
    data: LeadConnectionStatusUpdate,
    authorization: str = Header(...)
):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("leads")\
            .update({"connection_status": data.connection_status})\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"lead": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── SPREADSHEET UPDATE ───────────────────────────────────────

@router.patch("/leads/{lead_id}/spreadsheet")
async def spreadsheet_update_lead(
    lead_id: str,
    data: LeadSpreadsheetUpdate,
    authorization: str = Header(...)
):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        response = supabase.table("leads")\
            .update(update_data)\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"lead": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── COMPANY PREFILL ─────────────────────────────────────────

@router.post("/companies/prefill")
async def prefill_company(
    payload: dict,
    authorization: str = Header(...)
):
    get_user_id(authorization)
    import re as _re
    name = (payload.get("name") or "").strip()
    website_url = (payload.get("website_url") or "").strip()
    openrouter_key = payload.get("openrouter_key") or os.getenv("OPENROUTER_API_KEY", "")

    if not name:
        raise HTTPException(status_code=400, detail="Company name is required")
    if website_url:
        validate_external_url(website_url, "website_url")

    from .company_prefill import (
        search_company_website, extract_linkedin_url_from_html,
        extract_linkedin_url_with_qwen3, scrape_linkedin_data,
        search_linkedin_url_direct, search_linkedin_url_by_domain,
    )

    # Indian "(P) Ltd" / "Pvt Ltd" entities must be found via LinkedIn direct search —
    # website search returns the global parent company (e.g. hrblock.com for H&R Block India).
    is_indian_entity = bool(_re.search(
        r'\b(india|pvt\.?\s*ltd|p\.?\s*ltd|private\s+limited)\b', name, _re.I
    ))

    if not website_url and not is_indian_entity:
        website_url = search_company_website(name) or ""

    # For Indian entities: skip straight to LinkedIn search without needing a website
    if not website_url and not is_indian_entity:
        return {"name": name, "website_url": None, "linkedin_url": None, "linkedin_people_url": None,
                "message": "Could not find official website. Provide the website URL manually.",
                "linkedin_data": {}}

    url = website_url if website_url.startswith("http") else "https://" + website_url
    linkedin_url = None
    try:
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}, timeout=12, allow_redirects=True)
        html = r.text
        linkedin_url = extract_linkedin_url_from_html(html)
        if not linkedin_url and openrouter_key:
            linkedin_url = extract_linkedin_url_with_qwen3(html, name, openrouter_key)
    except Exception as e:
        print(f"Prefill website fetch error: {e}")

    # Fallback 1: domain-based search (site:linkedin.com/company "way.com")
    # Far more precise than slug guessing — finds pages that actually mention the domain.
    if not linkedin_url and website_url:
        try:
            linkedin_url = search_linkedin_url_by_domain(website_url)
            if linkedin_url:
                print(f"LinkedIn URL found via domain search for {name}: {linkedin_url}")
        except Exception as e:
            print(f"Domain-based LinkedIn search error: {e}")

    # Fallback 2: Scrape company homepage for LinkedIn company URL
    if not linkedin_url:
        try:
            from .enrichment import _fetch
            domain = urlparse(url).netloc.replace("www.", "")
            html = _fetch(f"https://{domain}")
            if html:
                li_match = re.search(
                    r'https?://(?:www\.)?linkedin\.com/company/([a-zA-Z0-9_-]+)',
                    html,
                )
                if li_match:
                    linkedin_url = f"https://www.linkedin.com/company/{li_match.group(1)}/"
                    print(f"LinkedIn URL found via site scrape for {name}: {linkedin_url}")
        except Exception as e:
            print(f"Site scrape LinkedIn fallback error: {e}")

    # Fallback 3: web search for LinkedIn URL by company name (least reliable — last resort)
    if not linkedin_url:
        try:
            linkedin_url = search_linkedin_url_direct(name)
            if linkedin_url:
                print(f"LinkedIn URL found via name search for {name}: {linkedin_url}")
        except Exception as e:
            print(f"LinkedIn URL search fallback error: {e}")

    # Fallback 4: Guess slug from domain base (e.g. sequantix.com → /company/sequantix)
    if not linkedin_url:
        try:
            domain = urlparse(url).netloc.replace("www.", "")
            slug = domain.split(".")[0]
            guessed = f"https://www.linkedin.com/company/{slug}/"
            probe = requests.get(
                guessed,
                headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US"},
                timeout=8, allow_redirects=True,
            )
            if probe.status_code == 200 and "linkedin.com/company/" in probe.url:
                linkedin_url = probe.url
                print(f"LinkedIn URL guessed from domain slug for {name}: {linkedin_url}")
        except Exception as e:
            print(f"Domain-slug LinkedIn guess error: {e}")

    linkedin_people_url = None
    if linkedin_url:
        m = _re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', linkedin_url)
        if m:
            linkedin_people_url = f'https://www.linkedin.com/company/{m.group(1)}/people/'

    # Scrape LinkedIn for followers, location, employee count
    linkedin_data = {}
    if linkedin_url:
        linkedin_data = scrape_linkedin_data(linkedin_url, li_cookie=os.getenv("LI_SESSION_COOKIE", ""))

    # Domain cross-check: verify scraped LinkedIn company belongs to the same domain
    if linkedin_url and website_url:
        def _root_domain_pf(u):
            try:
                from urllib.parse import urlparse as _up
                h = _up(u if "://" in u else "https://" + u).netloc.lower()
                h = h.replace("www.", "")
                parts = h.split(".")
                return ".".join(parts[-2:]) if len(parts) >= 2 else h
            except Exception:
                return ""

        _stored_root = _root_domain_pf(website_url)
        _li_website = linkedin_data.get("website", "")

        if _li_website:
            _scraped_root = _root_domain_pf(_li_website)
            if _stored_root and _scraped_root and _stored_root != _scraped_root:
                print(f"Prefill domain mismatch: company website={_stored_root}, LinkedIn website={_scraped_root} — clearing LinkedIn data")
                linkedin_url = None
                linkedin_people_url = None
                linkedin_data = {}
        elif linkedin_data:
            # LinkedIn scraped but no website listed — check slug vs domain core strictly.
            # When the company lists no website, we can't do a definitive domain check,
            # so require the slug to start with or equal the domain core (not just contain it).
            # "waycom" starts with "way" → allow. "waywayapp" starts with "way" → allow.
            # "way-com" scrubbed = "waycom" starts with "way" → allow.
            # "somethingway" starts with "something" not "way" → reject.
            _slug_m = _re.search(r'linkedin\.com/company/([a-zA-Z0-9-]+)', linkedin_url or '')
            if _slug_m and _stored_root:
                _dom_core = _stored_root.split(".")[0]
                _raw_slug = _slug_m.group(1).lower()
                _slug_parts = _raw_slug.split("-")
                _slug = _raw_slug.replace("-", "")
                # Reject letter-by-letter slugs like "w-a-y"
                _is_letter_slug = len(_slug_parts) > 1 and all(len(p) == 1 for p in _slug_parts)
                # Require slug to START with dom_core (or be exactly dom_core)
                _slug_starts = _slug.startswith(_dom_core) if len(_dom_core) >= 3 else True
                _mismatch = _is_letter_slug or (len(_dom_core) >= 3 and not _slug_starts)
                if _mismatch:
                    print(f"Prefill slug mismatch: slug={_raw_slug}, domain={_dom_core} (letter={_is_letter_slug}, starts={_slug_starts}) — clearing")
                    linkedin_url = None
                    linkedin_people_url = None
                    linkedin_data = {}

    return {
        "name": name,
        "website_url": website_url,
        "linkedin_url": linkedin_url,
        "linkedin_people_url": linkedin_people_url,
        "message": "LinkedIn URL found" if linkedin_url else "LinkedIn URL not found on website. Provide it manually.",
        "linkedin_data": linkedin_data,
    }


# ─── PEOPLE SEARCH (proprietary — site scrape + DDG LinkedIn) ────────────────

def _sonar_team_scrape(domain: str, roles: list) -> list:
    """
    Scrape company team/about pages for staff — proprietary people discovery.
    Looks for JSON-LD Person schema first, then email+name heuristics.
    """
    import json as _json
    from .enrichment import _fetch, _extract_emails_from_html, _GENERIC_LOCALS

    slugs = ["/team", "/about", "/about-us", "/people", "/our-team",
             "/leadership", "/management", "/who-we-are", "/press"]
    people = []
    seen_emails: set[str] = set()

    for slug in slugs:
        html = _fetch(f"https://{domain}{slug}")
        if not html:
            continue

        # JSON-LD Person / Organization schema
        ld_blocks = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL | re.IGNORECASE,
        )
        for block in ld_blocks:
            try:
                data = _json.loads(block)
                # flatten to list
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    # unwrap Organization.member / .employee
                    if item.get("@type") in ("Organization", "WebSite"):
                        items.extend(item.get("member") or item.get("employee") or [])
                        continue
                    if item.get("@type") != "Person":
                        continue
                    name  = (item.get("name") or "").strip()
                    title = (item.get("jobTitle") or "").strip()
                    email = (item.get("email") or "").replace("mailto:", "").strip()
                    li    = item.get("sameAs") or item.get("url") or ""
                    if not name:
                        continue
                    if roles and title and not any(r.lower() in title.lower() for r in roles):
                        continue
                    name_parts = name.split(" ", 1)
                    first = name_parts[0]
                    last  = name_parts[1] if len(name_parts) > 1 else ""
                    entry = {
                        "first_name":   first,
                        "last_name":    last,
                        "name":         name,
                        "title":        title,
                        "company":      domain,
                        "location":     "",
                        "linkedin_url": li if "linkedin.com" in (li or "") else "",
                        "email":        email,
                        "photo_url":    "",
                        "confidence":   85,
                    }
                    if email:
                        if email not in seen_emails:
                            seen_emails.add(email)
                            people.append(entry)
                    else:
                        people.append(entry)
            except Exception:
                continue

        # Personal emails found on page (no name, but useful)
        page_emails = [
            e for e in _extract_emails_from_html(html, domain)
            if e.split("@")[0] not in _GENERIC_LOCALS and e not in seen_emails
        ]
        for email in page_emails:
            seen_emails.add(email)
            local = email.split("@")[0]
            people.append({
                "first_name":   "",
                "last_name":    "",
                "name":         local,
                "title":        "",
                "company":      domain,
                "location":     "",
                "linkedin_url": "",
                "email":        email,
                "photo_url":    "",
                "confidence":   60,
            })

        if len(people) >= 30:
            break

    if roles:
        people = [
            p for p in people
            if not p["title"] or any(r.lower() in p["title"].lower() for r in roles)
        ]
    return people[:50]


def _ddgs_linkedin_search(company_name: str, roles: list) -> list:
    """Find LinkedIn profiles of people at a company via web search."""
    from .company_prefill import _web_search

    queries = []
    if roles:
        for role in roles[:4]:
            queries.append(f'site:linkedin.com/in/ "{company_name}" "{role}"')
    else:
        queries.append(f'site:linkedin.com/in/ "{company_name}"')

    seen_urls = set()
    people = []

    for q in queries:
        for r in _web_search(q, count=8):
            url = r.get("href", "")
            if "linkedin.com/in/" not in url:
                continue
            clean_url = url.split("?")[0].rstrip("/")
            if clean_url in seen_urls:
                continue
            seen_urls.add(clean_url)

            title_text = r.get("title", "")
            name, title = "", ""
            if " - " in title_text:
                parts = [p.strip() for p in title_text.split(" - ")]
                name  = parts[0]
                title = parts[1] if len(parts) > 1 else ""
            else:
                name = title_text.split("|")[0].strip()
            name = name.replace("| LinkedIn", "").strip()

            name_parts = name.split(" ", 1)
            first = name_parts[0] if name_parts else ""
            last  = name_parts[1] if len(name_parts) > 1 else ""

            people.append({
                "first_name":   first,
                "last_name":    last,
                "name":         name,
                "title":        title,
                "company":      company_name,
                "location":     "",
                "linkedin_url": clean_url,
                "email":        "",
                "photo_url":    "",
            })

    return people


@router.post("/companies/people-search")
async def search_company_people(payload: dict, authorization: str = Header(...)):
    """Find people at a company — Sonar site scrape + DDG LinkedIn discovery."""
    get_user_id(authorization)

    company_name = (payload.get("company_name") or "").strip()
    domain       = (payload.get("domain") or "").strip()
    roles        = payload.get("roles") or []

    if not company_name and not domain:
        raise HTTPException(status_code=400, detail="company_name or domain required")

    # 1. Sonar site scrape — JSON-LD schema + email extraction from company pages
    people = _sonar_team_scrape(domain, roles) if domain else []

    # 2. DDG LinkedIn search — supplement with people found via search
    if len(people) < 5:
        ddgs_people = _ddgs_linkedin_search(company_name, roles)
        existing_urls = {p["linkedin_url"] for p in people if p["linkedin_url"]}
        for p in ddgs_people:
            if p["linkedin_url"] not in existing_urls:
                people.append(p)
                existing_urls.add(p["linkedin_url"])

    return {"people": people, "total": len(people)}


# ─── UPDATE COMPANY SIZE BY NAME (called by extension after people page scrape) ──

@router.patch("/companies/size-by-name")
async def update_company_size_by_name(
    payload: dict,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    name = (payload.get("name") or "").strip()
    size = (payload.get("size") or "").strip()
    if not name or not size:
        raise HTTPException(status_code=400, detail="name and size required")
    try:
        res = supabase.table("companies").select("id").eq("user_id", user_id).ilike("name", name).execute()
        if not res.data:
            return {"updated": False, "message": "Company not found"}
        company_id = res.data[0]["id"]
        supabase.table("companies").update({"size": size}).eq("id", company_id).eq("user_id", user_id).execute()
        return {"updated": True, "company_id": company_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── COMPANY UPDATE ───────────────────────────────────────────

@router.patch("/companies/{company_id}")
async def update_company(
    company_id: str,
    data: CompanyUpdate,
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            co = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
            return {"company": co.data[0] if co.data else {}}
        response = supabase.table("companies")\
            .update(update_data)\
            .eq("id", company_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"company": response.data[0] if response.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    try:
        supabase.table("companies")\
            .delete()\
            .eq("id", company_id)\
            .eq("user_id", user_id)\
            .execute()
        posthog.capture(user_id, "company_deleted")
        return {"message": "Company deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/companies")
async def bulk_delete_companies(
    payload: dict,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No ids provided")
    try:
        supabase.table("companies")\
            .delete()\
            .in_("id", ids)\
            .eq("user_id", user_id)\
            .execute()
        posthog.capture(user_id, "companies_bulk_deleted", {"count": len(ids)})
        return {"deleted": len(ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/{company_id}/leads")
async def get_company_leads(
    company_id: str,
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    try:
        company = supabase.table("companies")\
            .select("*")\
            .eq("id", company_id)\
            .eq("user_id", user_id)\
            .execute()
        if not company.data:
            raise HTTPException(status_code=404, detail="Company not found")

        company_name = company.data[0]["name"]
        leads = supabase.table("leads")\
            .select("*")\
            .eq("user_id", user_id)\
            .ilike("company", company_name)\
            .execute()
        return {"company": company.data[0], "leads": leads.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── BUYING SIGNALS ──────────────────────────────────────────────

@router.get("/companies/{company_id}/signals")
async def get_company_signals(company_id: str, authorization: str = Header(...)):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    res = supabase.table("company_signals")\
        .select("*")\
        .eq("company_id", company_id)\
        .eq("user_id", user_id)\
        .order("relevance_score", desc=True)\
        .execute()
    return {"signals": res.data}


@router.post("/companies/{company_id}/signals")
async def detect_company_signals(
    company_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)

    co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    co = co_res.data[0]
    name = co.get("name", "")

    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    cached = supabase.table("company_signals")\
        .select("*")\
        .eq("company_id", company_id)\
        .eq("user_id", user_id)\
        .gt("detected_at", cutoff)\
        .execute()
    if cached.data and not payload.get("force"):
        return {"signals": sorted(cached.data, key=lambda x: -(x.get("relevance_score") or 0)), "cached": True}

    supabase.table("company_signals").delete().eq("company_id", company_id).eq("user_id", user_id).execute()

    raw_results = []
    try:
        from .company_prefill import _web_search
        queries = [
            f'"{name}" hiring security OR CISO OR compliance',
            f'"{name}" funding OR investment OR "Series A" OR "Series B"',
            f'"{name}" data breach OR regulatory OR GDPR OR ISO27001',
        ]
        for q in queries:
            for r in _web_search(q, count=4):
                raw_results.append({
                    "title": r.get("title", ""),
                    "body": r.get("body", ""),
                    "url": r.get("href", ""),
                })
    except Exception:
        pass

    search_ctx = ""
    for r in raw_results[:10]:
        search_ctx += f"- {r['title']}: {r['body'][:180]}\n"

    prompt = f"""You are a sales intelligence AI. Identify buying signals for a cybersecurity/compliance service.

Company: {name}
Industry: {co.get('industry') or 'Unknown'}
Size: {co.get('size') or 'Unknown'}
Description: {(co.get('description') or '')[:300]}

{"Search results:\n" + search_ctx if search_ctx else "Infer signals from industry and company size."}

Return 3-5 buying signals as a JSON array only:
[
  {{
    "signal_type": "hiring",
    "title": "Title under 70 chars",
    "description": "1-2 sentence explanation of why this is a buying signal",
    "relevance_score": 80,
    "source_url": ""
  }}
]
Signal types: hiring, funding, compliance, news, growth. Return only the JSON array."""

    import json as _json, re as _re
    raw = _call_ai(prompt, max_tokens=900, user_id=user_id, feature="company_signals")
    signals = []
    try:
        m = _re.search(r'\[.*?\]', raw, _re.DOTALL)
        if m:
            signals = _json.loads(m.group())
    except Exception:
        pass

    to_insert = []
    valid_types = {"hiring", "funding", "compliance", "news", "growth"}
    for s in signals[:6]:
        stype = s.get("signal_type", "news")
        if stype not in valid_types:
            stype = "news"
        to_insert.append({
            "user_id": user_id,
            "company_id": company_id,
            "signal_type": stype,
            "title": str(s.get("title", ""))[:200],
            "description": str(s.get("description", ""))[:500],
            "source_url": str(s.get("source_url", ""))[:500],
            "relevance_score": min(100, max(0, int(s.get("relevance_score", 50)))),
        })

    if to_insert:
        res = supabase.table("company_signals").insert(to_insert).execute()
        return {"signals": res.data, "cached": False}
    return {"signals": [], "cached": False}


@router.get("/leads/{lead_id}/signals")
async def get_lead_company_signals(lead_id: str, authorization: str = Header(...)):
    """Fetch cached buying signals for the company this lead works at."""
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    lead_res = supabase.table("leads").select("company").eq("id", lead_id).eq("user_id", user_id).execute()
    if not lead_res.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    company_name = lead_res.data[0].get("company", "")
    if not company_name:
        return {"signals": [], "company_id": None}
    co_res = supabase.table("companies").select("id").eq("user_id", user_id).ilike("name", company_name).limit(1).execute()
    if not co_res.data:
        return {"signals": [], "company_id": None}
    company_id = co_res.data[0]["id"]
    sigs = supabase.table("company_signals")\
        .select("*")\
        .eq("company_id", company_id)\
        .eq("user_id", user_id)\
        .order("relevance_score", desc=True)\
        .execute()
    return {"signals": sigs.data, "company_id": company_id}


# ─── EMAIL TRACKING ──────────────────────────────────────────────

_GIF_1x1 = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)
_API_BASE = os.getenv("API_BASE_URL", "https://leadgenengineplatform-api.vercel.app/api")

# Approximate IANA timezone by 2-letter country code — used for timezone-aware sending
_COUNTRY_TZ: dict = {
    "US": "America/New_York", "GB": "Europe/London", "DE": "Europe/Berlin",
    "FR": "Europe/Paris",     "NL": "Europe/Amsterdam", "SE": "Europe/Stockholm",
    "AU": "Australia/Sydney", "CA": "America/Toronto",  "IN": "Asia/Kolkata",
    "SG": "Asia/Singapore",   "JP": "Asia/Tokyo",       "AE": "Asia/Dubai",
    "BR": "America/Sao_Paulo","MX": "America/Mexico_City","ZA": "Africa/Johannesburg",
    "NG": "Africa/Lagos",     "KE": "Africa/Nairobi",   "EG": "Africa/Cairo",
    "PK": "Asia/Karachi",     "BD": "Asia/Dhaka",       "PH": "Asia/Manila",
    "ID": "Asia/Jakarta",     "TH": "Asia/Bangkok",     "VN": "Asia/Ho_Chi_Minh",
    "CN": "Asia/Shanghai",    "KR": "Asia/Seoul",       "TW": "Asia/Taipei",
    "NZ": "Pacific/Auckland", "ES": "Europe/Madrid",    "IT": "Europe/Rome",
    "PL": "Europe/Warsaw",    "RU": "Europe/Moscow",    "TR": "Europe/Istanbul",
    "IL": "Asia/Jerusalem",   "SA": "Asia/Riyadh",      "HK": "Asia/Hong_Kong",
    "NO": "Europe/Oslo",      "DK": "Europe/Copenhagen","FI": "Europe/Helsinki",
    "BE": "Europe/Brussels",  "CH": "Europe/Zurich",    "AT": "Europe/Vienna",
    "PT": "Europe/Lisbon",    "IE": "Europe/Dublin",    "CZ": "Europe/Prague",
    "HU": "Europe/Budapest",  "RO": "Europe/Bucharest", "UA": "Europe/Kyiv",
    "GR": "Europe/Athens",    "MY": "Asia/Kuala_Lumpur","LK": "Asia/Colombo",
    "AR": "America/Argentina/Buenos_Aires", "CO": "America/Bogota",
    "CL": "America/Santiago", "PE": "America/Lima",
}


@router.post("/leads/{lead_id}/track-email")
async def create_email_tracking(lead_id: str, payload: dict, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(lead_id)
    tracking_id = secrets.token_urlsafe(20)
    subject    = payload.get("subject", "")
    body       = payload.get("body", "")

    # Wrap links in the body with click-tracking redirects
    def wrap_url(m):
        raw = m.group(0)
        import urllib.parse
        encoded = urllib.parse.quote(raw, safe='')
        return f"{_API_BASE}/track/click/{tracking_id}?url={encoded}"

    tracked_body = _re.sub(r'https?://[^\s\)\"\'<>]+', wrap_url, body)
    # Append tracking pixel
    pixel_url  = f"{_API_BASE}/track/open/{tracking_id}"
    tracked_body_html = tracked_body + f'\n\n<img src="{pixel_url}" width="1" height="1" alt="" style="display:none">'

    supabase.table("email_tracking").insert({
        "user_id": user_id,
        "lead_id": lead_id,
        "tracking_id": tracking_id,
        "subject": subject,
        "body_preview": body[:120],
    }).execute()

    return {
        "tracking_id": tracking_id,
        "subject": subject,
        "body": tracked_body,
        "body_html": tracked_body_html,
        "pixel_url": pixel_url,
    }


@router.get("/leads/{lead_id}/email-opens")
async def get_email_opens(lead_id: str, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(lead_id)
    rows = (
        supabase.table("email_tracking")
        .select("*")
        .eq("lead_id", lead_id)
        .eq("user_id", user_id)
        .order("sent_at", desc=True)
        .limit(20)
        .execute()
    )
    # For each tracking_id, pull clicks
    result = []
    for row in rows.data:
        clicks = (
            supabase.table("email_clicks")
            .select("url,clicked_at")
            .eq("tracking_id", row["tracking_id"])
            .order("clicked_at", desc=False)
            .execute()
        )
        result.append({**row, "clicks": clicks.data})
    return {"emails": result}


# Public — no auth — called by email clients loading the pixel
@router.get("/track/open/{tracking_id}")
async def track_open(tracking_id: str):
    try:
        row = _first(
            supabase.table("email_tracking")
            .select("open_count,first_opened_at,lead_id")
            .eq("tracking_id", tracking_id)
            .limit(1)
            .execute()
        )
        if row:
            now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
            prev_opens = row.get("open_count") or 0
            update = {"open_count": prev_opens + 1, "last_opened_at": now}
            if not row.get("first_opened_at"):
                update["first_opened_at"] = now
            supabase.table("email_tracking").update(update).eq("tracking_id", tracking_id).execute()
            # Boost engagement score on first open
            if prev_opens == 0 and row.get("lead_id"):
                try:
                    cur = _first(supabase.table("leads").select("engagement_score").eq("id", row["lead_id"]).limit(1).execute())
                    cur_score = (cur or {}).get("engagement_score") or 0
                    supabase.table("leads").update({"engagement_score": min(100, cur_score + 3), "last_engaged_at": now}).eq("id", row["lead_id"]).execute()
                except Exception:
                    pass
    except Exception:
        pass
    return Response(content=_GIF_1x1, media_type="image/gif", headers={
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    })


# Public — no auth — wraps links for click tracking
@router.get("/track/click/{tracking_id}")
async def track_click(tracking_id: str, url: str):
    try:
        now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
        supabase.table("email_clicks").insert({
            "tracking_id": tracking_id,
            "url": url,
            "clicked_at": now,
        }).execute()
        row = _first(supabase.table("email_tracking").select("click_count,lead_id").eq("tracking_id", tracking_id).limit(1).execute())
        if row is not None:
            prev_clicks = row.get("click_count") or 0
            supabase.table("email_tracking").update({"click_count": prev_clicks + 1}).eq("tracking_id", tracking_id).execute()
            # Boost engagement score on first link click (+5 for higher intent)
            if prev_clicks == 0 and row.get("lead_id"):
                try:
                    cur = _first(supabase.table("leads").select("engagement_score").eq("id", row["lead_id"]).limit(1).execute())
                    cur_score = (cur or {}).get("engagement_score") or 0
                    supabase.table("leads").update({"engagement_score": min(100, cur_score + 5), "last_engaged_at": now}).eq("id", row["lead_id"]).execute()
                except Exception:
                    pass
    except Exception:
        pass
    return RedirectResponse(url=url, status_code=302)


# ─── ACTIVITY TIMELINE ───────────────────────────────────────────

@router.post("/leads/{lead_id}/activity")
async def log_activity(lead_id: str, payload: dict, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(lead_id)
    event_type = payload.get("event_type")
    valid = {"created","scored","email_drafted","email_sent","status_changed",
             "connection_changed","note_saved","signal_detected","enriched"}
    if event_type not in valid:
        raise HTTPException(status_code=400, detail="Invalid event_type")
    row = supabase.table("lead_activity").insert({
        "user_id": user_id,
        "lead_id": lead_id,
        "event_type": event_type,
        "data": payload.get("data", {}),
    }).execute()
    return {"activity": row.data[0] if row.data else {}}


@router.get("/leads/{lead_id}/activity")
async def get_activity(lead_id: str, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(lead_id)
    rows = (
        supabase.table("lead_activity")
        .select("*")
        .eq("lead_id", lead_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"activity": rows.data}


# ─── TASKS ───────────────────────────────────────────────────────

@router.get("/tasks")
async def list_all_tasks(completed: str = "false", authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    is_done = completed.lower() == "true"
    rows = (
        supabase.table("tasks")
        .select("*, leads(name, company)")
        .eq("user_id", user_id)
        .eq("completed", is_done)
        .order("due_date", desc=False, nullsfirst=False)
        .limit(100)
        .execute()
    )
    return {"tasks": rows.data}


@router.post("/leads/{lead_id}/tasks")
async def create_task(lead_id: str, payload: dict, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(lead_id)
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    row = supabase.table("tasks").insert({
        "user_id": user_id,
        "lead_id": lead_id,
        "title": title,
        "due_date": payload.get("due_date"),
        "priority": payload.get("priority", "medium"),
    }).execute()
    return {"task": row.data[0] if row.data else {}}


@router.get("/leads/{lead_id}/tasks")
async def get_lead_tasks(lead_id: str, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(lead_id)
    rows = (
        supabase.table("tasks")
        .select("*")
        .eq("lead_id", lead_id)
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return {"tasks": rows.data}


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: dict, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(task_id)
    update = {}
    if "title"     in payload: update["title"]     = payload["title"]
    if "due_date"  in payload: update["due_date"]  = payload["due_date"]
    if "priority"  in payload: update["priority"]  = payload["priority"]
    if "completed" in payload:
        update["completed"] = payload["completed"]
        update["completed_at"] = __import__("datetime").datetime.utcnow().isoformat() + "Z" if payload["completed"] else None
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    row = (
        supabase.table("tasks")
        .update(update)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"task": row.data[0] if row.data else {}}


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(task_id)
    supabase.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/tasks")
async def create_standalone_task(payload: dict, authorization: str = Header(...)):
    """Create a standalone task not linked to a specific lead."""
    user_id = get_user_id(authorization)
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title required")
    row = supabase.table("tasks").insert({
        "user_id":   user_id,
        "lead_id":   payload.get("lead_id") or None,
        "title":     title,
        "body":      payload.get("body") or "",
        "due_date":  payload.get("due_date") or None,
        "priority":  payload.get("priority") or "medium",
        "completed": False,
    }).execute()
    return {"task": row.data[0] if row.data else {}}


# ─── EMAIL TEMPLATES ─────────────────────────────────────────────

@router.get("/email-templates")
async def list_templates(authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    rows = (
        supabase.table("email_templates")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"templates": rows.data}


@router.post("/email-templates")
async def create_template(payload: dict, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    name = (payload.get("name") or "").strip()
    body = (payload.get("body") or "").strip()
    if not name or not body:
        raise HTTPException(status_code=400, detail="name and body required")
    row = supabase.table("email_templates").insert({
        "user_id": user_id,
        "name": name,
        "subject": payload.get("subject", ""),
        "body": body,
    }).execute()
    return {"template": row.data[0] if row.data else {}}


@router.patch("/email-templates/{tpl_id}")
async def update_template(tpl_id: str, payload: dict, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(tpl_id)
    update = {k: v for k, v in payload.items() if k in ("name", "subject", "body")}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    row = (
        supabase.table("email_templates")
        .update(update)
        .eq("id", tpl_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"template": row.data[0] if row.data else {}}


@router.delete("/email-templates/{tpl_id}")
async def delete_template(tpl_id: str, authorization: str = Header(...)):
    user_id = _get_user_id(authorization)
    validate_uuid(tpl_id)
    supabase.table("email_templates").delete().eq("id", tpl_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ─── TECHNOPARK DIRECTORY ────────────────────────────────────────

_TECHNOPARK_DISK_CACHE = os.path.join(
    "/tmp" if os.getenv("VERCEL") else os.path.dirname(__file__),
    "_technopark_cache.json"
)
_technopark_cache: dict = {"data": None, "fetched_at": 0}

# Load disk cache on startup so backend restarts don't lose data
try:
    import json as _json_cache
    if os.path.exists(_TECHNOPARK_DISK_CACHE):
        with open(_TECHNOPARK_DISK_CACHE) as _f:
            _technopark_cache = _json_cache.load(_f)
except Exception:
    pass

_GENERIC_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'rediffmail.com', 'ymail.com', 'live.com', 'icloud.com',
}

@router.get("/companies/technopark-directory")
async def get_technopark_directory(
    search: str = "",
    park:   str = "",
    building: str = "",
    authorization: str = Header(...)
):
    """Return Technopark company directory, filtered and enriched, with already-added flag."""
    import time as _time
    user_id = get_user_id(authorization)

    # Refresh cache every 30 minutes; on failure serve stale data rather than erroring
    if not _technopark_cache["data"] or (_time.time() - _technopark_cache["fetched_at"]) > 1800:
        _fetch_error = None
        for _url in [
            "https://technopark.in/api/companies",
            "http://technopark.in/api/companies",
        ]:
            try:
                resp = requests.get(
                    _url,
                    headers={"Accept": "application/json",
                             "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
                    timeout=15
                )
                resp.raise_for_status()
                _technopark_cache["data"] = resp.json()
                _technopark_cache["fetched_at"] = _time.time()
                _fetch_error = None
                try:
                    import json as _jc
                    with open(_TECHNOPARK_DISK_CACHE, "w") as _wf:
                        _jc.dump(_technopark_cache, _wf)
                except Exception:
                    pass
                break
            except Exception as e:
                _fetch_error = e
                continue
        if _fetch_error and not _technopark_cache["data"]:
            raise HTTPException(status_code=502, detail=f"Could not fetch Technopark directory: {_fetch_error}")

    raw = _technopark_cache["data"] or []

    # Derive website from email domain
    def _website_from_email(email: str) -> str | None:
        if not email or '@' not in email:
            return None
        domain = email.split('@')[1].strip().lower()
        if domain in _GENERIC_EMAIL_DOMAINS:
            return None
        return f"https://{domain}"

    # Build normalised list
    companies = []
    for c in raw:
        website = _website_from_email(c.get("company_email", ""))
        companies.append({
            "technopark_id": c.get("company_id"),
            "name":          c.get("company_name", "").strip(),
            "website":       website,
            "email":         c.get("company_email", "").strip(),
            "building":      c.get("company_buildings", "").strip(),
            "park":          c.get("company_parks", "").strip(),
            "address":       c.get("company_address", "").replace('\r\n', ', ').strip(),
            "contact_name":  c.get("company_contact_person", "").strip(),
            "contact_title": c.get("company_designation", "").strip(),
        })

    # Apply filters
    if search:
        q = search.lower()
        companies = [c for c in companies if q in c["name"].lower()]
    if park:
        companies = [c for c in companies if park.lower() in c["park"].lower()]
    if building:
        companies = [c for c in companies if building.lower() in c["building"].lower()]

    # Flag already-added companies
    if companies:
        existing = supabase.table("companies").select("name").eq("user_id", user_id).execute()
        added_names = {r["name"].strip().lower() for r in (existing.data or [])}
        for c in companies:
            c["already_added"] = c["name"].lower() in added_names

    # Unique building and park lists for filters
    all_parks     = sorted({c["park"]     for c in _technopark_cache["data"] and
                            [{"park": r.get("company_parks","").strip()} for r in _technopark_cache["data"]] or []})
    all_buildings = sorted({r.get("company_buildings","").strip() for r in (_technopark_cache["data"] or []) if r.get("company_buildings")})

    return {
        "companies": companies,
        "total":     len(companies),
        "parks":     ["TECHNOPARK PHASE I", "TECHNOPARK PHASE II", "TECHNOPARK PHASE III"],
        "buildings": all_buildings,
    }


# ─── BULK COMPANY SAVE ────────────────────────────────────────

@router.post("/companies/bulk")
async def bulk_create_companies(
    payload: dict,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    companies = payload.get("companies", [])
    print(f"DEBUG companies bulk: received {len(companies)} companies, first: {companies[0].get('name') if companies else 'none'}")
    if not companies:
        raise HTTPException(status_code=400, detail="No companies provided")

    inserted = []
    updated = []
    skipped = 0

    for company in companies:
        try:
            if not company.get("name"):
                skipped += 1
                continue

            name = company["name"].strip()

            # Check if this company already exists for this user
            existing = supabase.table("companies")\
                .select("id, website, size, followers")\
                .eq("user_id", user_id)\
                .eq("name", name)\
                .execute()

            if existing.data:
                # Upsert — overwrite website / size / followers with CSV values when provided.
                # CSV is the source of truth for these fields; autofill enrichment data
                # (linkedin_url, description, headquarters) is left untouched.
                existing_id = existing.data[0]["id"]
                patch = {}
                if company.get("website"):
                    patch["website"] = company["website"]
                if company.get("size"):
                    patch["size"] = company["size"]
                if company.get("followers"):
                    patch["followers"] = company["followers"]

                if patch:
                    supabase.table("companies").update(patch).eq("id", existing_id).eq("user_id", user_id).execute()
                    updated.append(existing_id)
                else:
                    skipped += 1
                continue

            data = {
                "user_id": user_id,
                "name": name,
                "industry": company.get("industry") or None,
                "size": company.get("size") or None,
                "followers": company.get("followers") or None,
                "headquarters": company.get("headquarters") or None,
                "description": company.get("description") or None,
                "website": company.get("website") or None,
                "linkedin_url": company.get("linkedin_url") or company.get("linkedinUrl") or company.get("salesNavUrl") or None,
                "phone": company.get("phone") or None,
                "founded": company.get("founded") or None,
                "specialties": company.get("specialties") or None,
                "tagline": company.get("tagline") or None,
            }

            response = supabase.table("companies").insert(data).execute()
            inserted.append(response.data[0])

        except Exception as e:
            print(f"Company insert error: {e}")
            skipped += 1
            continue

    posthog.capture(user_id, "companies_bulk_created", {
        "inserted": len(inserted),
        "updated": len(updated),
        "skipped": skipped,
        "total": len(companies),
    })
    return {
        "inserted": len(inserted),
        "updated": len(updated),
        "skipped": skipped,
        "companies": inserted,
        "all_ids": [c["id"] for c in inserted] + updated,
    }

# ─── COMPLIANCE CHECKER ───────────────────────────────────────

@router.post("/companies/{company_id}/check-compliance")
async def check_compliance(
    company_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    try:
        co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
        if not co_res.data:
            raise HTTPException(status_code=404, detail="Company not found")
        company = co_res.data[0]

        groq_key        = payload.get("groq_key")       or os.getenv("GROQ_API_KEY", "")
        gemini_key      = payload.get("gemini_key")     or os.getenv("GEMINI_API_KEY", "")
        openrouter_key  = payload.get("openrouter_key") or os.getenv("OPENROUTER_API_KEY", "")
        website = company.get("website", "")

        compliance_found = []
        has_security_team = "Unknown"
        security_notes = ""
        confidence = "Low"

        # Step 1 — scrape website for compliance text (most reliable)
        if website:
            from .website_analyzer import fetch_website_content
            website_data = fetch_website_content(website)
            if website_data:
                compliance_found = website_data.get("compliance_detected", [])
                full_text = website_data.get("full_text", "").lower()
                # Check for security team signals
                security_signals = ["security team", "security engineer", "ciso", "chief security", "infosec", "information security", "security operations"]
                if any(s in full_text for s in security_signals):
                    has_security_team = "Yes"
                    confidence = "High"
                else:
                    has_security_team = "Unknown"
                    confidence = "Medium"
                security_notes = f"Detected from website: {website}"

        # Step 2 — use AI to verify and add more context only if AI key available
        if (groq_key or gemini_key or openrouter_key) and company.get("name"):
            company_name = company.get("name", "")
            industry = company.get("industry", "")
            description = company.get("description", "")

            prompt = f"""Company: {company_name}
Industry: {industry or "Unknown"}
Description: {description or "None"}
Compliance already detected from their website: {compliance_found}

Based ONLY on what's likely for this specific company given their industry and description, what compliance standards might they have?
DO NOT make up standards. Only include ones that are highly likely given the industry.

Reply with ONLY valid JSON:
{{"additional_compliance": [], "has_security_team": "Yes" or "No" or "Unknown", "confidence": "High" or "Medium" or "Low", "notes": "one sentence"}}

IMPORTANT: Return empty additional_compliance array if not sure. Do not guess."""

            try:
                content = ""
                if gemini_key:
                    res = requests.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}',
                        headers={'Content-Type': 'application/json'},
                        json={'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 200}},
                        timeout=15
                    )
                    d = res.json()
                    if 'error' not in d:
                        content = d['candidates'][0]['content']['parts'][0]['text'].strip()
                if not content and openrouter_key:
                    res = requests.post(
                        'https://openrouter.ai/api/v1/chat/completions',
                        headers={'Authorization': f'Bearer {openrouter_key}', 'Content-Type': 'application/json',
                                 'HTTP-Referer': 'https://leadgen.app', 'X-Title': 'Leadgen Platform'},
                        json={'model': 'google/gemini-2.0-flash-exp:free', 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': 200, 'temperature': 0.1},
                        timeout=15
                    )
                    d = res.json()
                    if 'choices' in d:
                        content = d['choices'][0]['message']['content'].strip()
                if not content and groq_key:
                    res = requests.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'},
                        json={'model': 'llama-3.1-8b-instant', 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': 200, 'temperature': 0.1},
                        timeout=10
                    )
                    d = res.json()
                    if 'choices' in d:
                        content = d['choices'][0]['message']['content'].strip()

                import re, json as jsonlib
                content = re.sub(r'^```json\s*', '', content)
                content = re.sub(r'\s*```$', '', content)
                ai_result = jsonlib.loads(content)

                # Only add AI compliance if it's not already found and is credible
                additional = ai_result.get("additional_compliance", [])
                for item in additional:
                    if item and item not in compliance_found:
                        compliance_found.append(item)

                if has_security_team == "Unknown":
                    has_security_team = ai_result.get("has_security_team", "Unknown")
                    confidence = ai_result.get("confidence", confidence)
                    security_notes = ai_result.get("notes", security_notes)

            except Exception as e:
                print(f"AI compliance error: {e}")

        compliance_str = ", ".join(compliance_found) if compliance_found else "None detected"

        # Save to database
        if compliance_found:
            supabase.table("companies").update({"compliance": compliance_str}).eq("id", company_id).eq("user_id", user_id).execute()

        posthog.capture(user_id, "company_compliance_checked", {
            "compliance_found": len(compliance_found),
            "has_security_team": has_security_team,
            "confidence": confidence,
            "source": "website+ai" if website else "ai_only",
        })
        return {
            "compliance": compliance_str,
            "has_security_team": has_security_team,
            "security_notes": security_notes,
            "confidence": confidence,
            "source": "Website scraping + AI verification" if website else "AI only"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    # ─── BULK AUTO-FILL ───────────────────────────────────────────

@router.post("/leads/autofill-bulk")
async def autofill_bulk(
    payload: dict,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    lead_ids = payload.get("lead_ids", [])
    groq_api_key = payload.get("groq_api_key", "")
    batch_start = payload.get("batch_start", 0)
    batch_size = 20

    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")

    # Process current batch
    batch = lead_ids[batch_start:batch_start + batch_size]
    has_more = (batch_start + batch_size) < len(lead_ids)

    try:
        from groq import Groq
        import json, re

        # Build company cache to avoid duplicate Groq calls
        company_cache = {}

        # Get all leads in batch
        leads_res = supabase.table("leads")\
            .select("*")\
            .in_("id", batch)\
            .eq("user_id", user_id)\
            .execute()

        if not leads_res.data:
            return {"results": [], "processed": 0, "has_more": has_more, "next_batch_start": batch_start + batch_size}

        # Get all security leads for user to check security teams
        all_leads_res = supabase.table("leads")\
            .select("company, title")\
            .eq("user_id", user_id)\
            .execute()

        # Build security team map per company
        security_keywords = ["ciso", "security engineer", "security analyst", "security architect",
                           "cybersecurity", "infosec", "grc", "penetration tester",
                           "vulnerability", "soc analyst", "devsecops", "security manager",
                           "security director", "security lead", "it security"]
        security_companies = set()
        if all_leads_res.data:
            for l in all_leads_res.data:
                title = (l.get("title") or "").lower()
                company = (l.get("company") or "").lower()
                if company and any(kw in title for kw in security_keywords):
                    security_companies.add(company)

        results = []
        client = Groq(api_key=groq_api_key) if groq_api_key else None

        for lead in leads_res.data:
            try:
                lead_id = lead["id"]
                company_name = lead.get("company", "") or ""
                company_key = company_name.lower().strip()

                update_data = {}

                # Security team from leads data
                has_security = "Yes" if company_key in security_companies else "No"
                update_data["has_security_team"] = has_security

                # Employee count and org size — check lead first, then company table
                employee_count = lead.get("employee_count", "") or ""
                if not employee_count:
                    try:
                        co_emp = supabase.table("companies")\
                            .select("size")\
                            .eq("user_id", user_id)\
                            .ilike("name", company_name)\
                            .execute()
                        if co_emp.data and co_emp.data[0].get("size"):
                            employee_count = co_emp.data[0]["size"]
                    except Exception:
                        pass

                if employee_count:
                    update_data["employee_count"] = employee_count
                    nums = [int(n) for n in re.findall(r'\d+', employee_count)]
                    if nums:
                        n = nums[0]
                        if n <= 10: update_data["org_size"] = "1-10"
                        elif n <= 50: update_data["org_size"] = "11-50"
                        elif n <= 200: update_data["org_size"] = "51-200"
                        elif n <= 500: update_data["org_size"] = "201-500"
                        elif n <= 1000: update_data["org_size"] = "501-1000"
                        else: update_data["org_size"] = "1000+"

                # Followers
                followers = lead.get("followers_count", "") or ""
                if followers:
                    update_data["followers_count"] = followers

                # Use Groq for website + revenue — cached per company
                if client and company_name:
                    if company_key not in company_cache:
                        existing_website = ""
                        existing_revenue = ""
                        try:
                            co_res = supabase.table("companies")\
                                .select("website, revenue")\
                                .eq("user_id", user_id)\
                                .ilike("name", company_name)\
                                .execute()
                            if co_res.data:
                                existing_website = co_res.data[0].get("website") or ""
                                existing_revenue = co_res.data[0].get("revenue") or ""
                        except Exception:
                            pass

                        if existing_website and existing_revenue:
                            company_cache[company_key] = {
                                "website": existing_website,
                                "revenue": existing_revenue
                            }
                        else:
                            try:
                                prompt = f"""For the company "{company_name}", provide accurate data. Return ONLY valid JSON:
{{"website": "https://domain.com", "revenue": "number_in_USD_millions_or_empty", "has_security_team": "Yes or No or Unknown", "company_type": "Product or Services or Hybrid"}}

Rules:
- website: full URL with https://, empty string if unknown
- revenue: number only in USD millions, empty string if unknown
- has_security_team: Yes if cybersecurity/fintech/large tech company, No if small company, Unknown if unsure
- company_type: Product if SaaS/software product, Services if consulting/outsourcing, Hybrid if both

Company: {company_name}
Industry: {lead.get('industry', lead.get('title', 'technology'))}
Be conservative and accurate. No explanation."""
                                # Try Gemini first, then Groq
                                _gemini_key = payload.get("gemini_api_key") or os.getenv("GEMINI_API_KEY", "")
                                _groq_key = payload.get("groq_api_key") or os.getenv("GROQ_API_KEY", "")
                                response_text = None
                                if _gemini_key:
                                    try:
                                        _r = requests.post(
                                            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={_gemini_key}',
                                            headers={'Content-Type': 'application/json'},
                                            json={'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 150}},
                                            timeout=15
                                        )
                                        _d = _r.json()
                                        response_text = _d['candidates'][0]['content']['parts'][0]['text'].strip()
                                    except Exception as _e:
                                        print(f"Gemini autofill error: {_e}")
                                if not response_text and _groq_key:
                                    try:
                                        completion = client.chat.completions.create(
                                            model="llama-3.3-70b-versatile",
                                            messages=[{"role": "user", "content": prompt}],
                                            temperature=0.1,
                                            max_tokens=150,
                                        )
                                        response_text = completion.choices[0].message.content.strip()
                                    except Exception as _e:
                                        print(f"Groq autofill error: {_e}")
                                if "```" in response_text:
                                    parts = response_text.split("```")
                                    response_text = parts[1] if len(parts) > 1 else response_text
                                    if response_text.startswith("json"):
                                        response_text = response_text[4:].strip()
                                ai_data = json.loads(response_text)
                                company_cache[company_key] = {
                                    "website": existing_website or ai_data.get("website", ""),
                                    "revenue": existing_revenue or ai_data.get("revenue", ""),
                                    "has_security_team": ai_data.get("has_security_team", "Unknown"),
                                    "company_type": ai_data.get("company_type", "")
                                }
                            except Exception as e:
                                print(f"Groq error for {company_name}: {e}")
                                company_cache[company_key] = {"website": existing_website, "revenue": existing_revenue}

                    cached = company_cache.get(company_key, {})
                    if cached.get("website") and not lead.get("website"):
                        w = cached["website"].replace("https://", "").replace("http://", "").strip()
                        if w:
                            update_data["website"] = "https://" + w if not w.startswith("http") else w
                    if cached.get("revenue"):
                        update_data["revenue"] = cached["revenue"]
                    # Detect security team from all leads of same company
                    if not update_data.get("has_security_team"):
                        try:
                            sec_titles = ["ciso", "security engineer", "security analyst", "security architect",
                                        "infosec", "information security", "security operations", "soc analyst",
                                        "penetration tester", "security manager", "chief security"]
                            company_leads_res = supabase.table("leads")                                .select("title")                                .eq("user_id", user_id)                                .ilike("company", f"%{company_name}%")                                .execute()
                            if company_leads_res.data:
                                titles = [l.get("title", "").lower() for l in company_leads_res.data if l.get("title")]
                                has_sec = any(any(st in t for st in sec_titles) for t in titles)
                                if has_sec:
                                    update_data["has_security_team"] = "Yes"
                        except Exception:
                            pass
                    if cached.get("has_security_team") and cached["has_security_team"] != "Unknown":
                        if not update_data.get("has_security_team"):
                            update_data["has_security_team"] = cached["has_security_team"]
                    if cached.get("company_type"):
                        update_data["company_type"] = cached["company_type"]

                # Update lead
                supabase.table("leads")\
                    .update(update_data)\
                    .eq("id", lead_id)\
                    .eq("user_id", user_id)\
                    .execute()

                results.append({
                    "lead_id": lead_id,
                    "updated": list(update_data.keys()),
                    "data": update_data
                })

            except Exception as e:
                print(f"Error processing lead {lead.get('id')}: {e}")
                continue

        posthog.capture(user_id, "leads_autofill_completed", {
            "processed": len(results),
            "has_more": has_more,
            "batch_start": batch_start,
            "total": len(lead_ids),
        })
        return {
            "results": results,
            "processed": len(results),
            "has_more": has_more,
            "next_batch_start": batch_start + batch_size,
            "total": len(lead_ids)
        }

    except Exception as e:
        import traceback
        print(f"AUTOFILL BULK ERROR: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

  # ─── WEBSITE ANALYZER ────────────────────────────────────────

@router.post("/companies/{company_id}/analyze-website")
async def analyze_company_website(
    company_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    try:
        co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
        if not co_res.data:
            raise HTTPException(status_code=404, detail="Company not found")
        company = co_res.data[0]

        from .website_analyzer import (
            fetch_website_content, analyze_with_gemini, analyze_with_openai,
            analyze_with_groq, classify_with_groq, classify_company_type_rules,
            analyze_with_openrouter,
        )

        openai_key      = payload.get("openai_key")      or os.getenv("OPENAI_API_KEY", "")
        gemini_key      = payload.get("gemini_key")      or os.getenv("GEMINI_API_KEY", "")
        groq_key        = payload.get("groq_key")        or os.getenv("GROQ_API_KEY", "")
        openrouter_key  = payload.get("openrouter_key")  or os.getenv("OPENROUTER_API_KEY", "")
        openrouter_model = payload.get("openrouter_model") or ""
        website         = company.get("website") or payload.get("website", "")

        # ── Step 1: fetch website content ──────────────────────────
        website_data = fetch_website_content(website) if website else None

        # ── Step 2: rule-based product/service classification ──────
        rule_type, rule_confidence = classify_company_type_rules(
            website_data, company.get("description", "")
        )

        # ── Step 3: AI analysis — Gemini → OpenRouter → OpenAI → Groq ──
        result = {}
        if rule_confidence != "High":
            if website_data and gemini_key:
                result = analyze_with_gemini(website_data, company.get("name", ""), gemini_key)
            if not result and openrouter_key:
                kw = {"model": openrouter_model} if openrouter_model else {}
                result = analyze_with_openrouter(website_data, company.get("name", ""), openrouter_key, **kw) or {}
            if not result and website_data and openai_key:
                ai_res = analyze_with_openai(website_data, company.get("name", ""), openai_key)
                if not ai_res.get("_openai_error"):
                    result = ai_res
            if not result and groq_key:
                result = analyze_with_groq(
                    website_data, company.get("name", ""),
                    company.get("industry", ""), company.get("description", ""), groq_key
                )

        # If no AI key and rules were Low-confidence, still return rule result
        if not result and not rule_type:
            raise HTTPException(
                status_code=400,
                detail="No AI key available and website signals are ambiguous. Add Gemini (free at aistudio.google.com), Groq, OpenRouter, or OpenAI key in Settings."
            )

        # ── Step 4: merge rule result with AI result ────────────────
        # Normalize AI "Services" → "Service" for consistency
        ai_type = result.get("company_type", "")
        if ai_type == "Services": result["company_type"] = "Service"

        # Rules always win when they are High or Medium confidence
        final_type = rule_type or result.get("company_type")
        if rule_confidence in ("High", "Medium") and rule_type:
            final_type = rule_type
            result["company_type"] = rule_type
            result["company_type_confidence"] = rule_confidence
        else:
            result["company_type_confidence"] = "AI"

        # Merge compliance from website scraping + AI
        scraped_compliance = website_data.get("compliance_detected", []) if website_data else []
        ai_compliance      = result.get("compliance", [])
        merged_compliance  = list(dict.fromkeys(scraped_compliance + ai_compliance))  # dedup, preserve order

        result["compliance"]    = merged_compliance
        result["company_type"]  = final_type

        # ── Step 5: save to DB ─────────────────────────────────────
        update_data = {}
        if final_type:
            update_data["company_type"] = final_type          # Product / Service / Hybrid
        if merged_compliance:
            update_data["compliance"] = ", ".join(merged_compliance)
        if result.get("website_summary") and not company.get("description"):
            update_data["description"] = result["website_summary"]
        if result.get("is_saas") is not None:
            update_data["is_saas"] = bool(result["is_saas"])
        if update_data:
            supabase.table("companies").update(update_data).eq("id", company_id).eq("user_id", user_id).execute()

        ai_provider = "gemini" if gemini_key else "openai" if openai_key else "groq" if groq_key else "rules-only"
        posthog.capture(user_id, "company_website_analyzed", {
            "has_website": bool(website),
            "ai_provider": ai_provider,
            "company_type": final_type,
            "rule_confidence": rule_confidence,
        })
        return {"success": True, "analysis": result, "company_id": company_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── AUTOFILL FROM LINKEDIN ──────────────────────────────────

@router.post("/companies/{company_id}/autofill-linkedin")
async def autofill_company_from_linkedin(
    company_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)
    import re as _re
    try:
        co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
        if not co_res.data:
            raise HTTPException(status_code=404, detail="Company not found")
        company = co_res.data[0]

        from .company_prefill import (
            search_company_website, search_linkedin_url_direct,
            search_linkedin_url_by_domain,
            extract_linkedin_url_from_html, extract_linkedin_url_with_qwen3,
            scrape_linkedin_data, _is_indian_entity, clean_name_for_search,
        )

        openrouter_key = payload.get("openrouter_key") or os.getenv("OPENROUTER_API_KEY", "")
        li_cookie      = payload.get("li_cookie") or os.getenv("LI_SESSION_COOKIE", "")
        company_name   = company.get("name", "")
        search_name    = clean_name_for_search(company_name)
        is_indian      = _is_indian_entity(company_name)

        linkedin_url  = company.get("linkedin_url") or ""
        stored_website = company.get("website") or ""  # original DB value — used for domain search
        found_website  = stored_website                # may be updated below; used for saving
        _li_url_source = "stored" if linkedin_url else ""

        if is_indian:
            # Reject stored linkedin_url that points to global parent (no "india" in slug)
            if linkedin_url and 'india' not in linkedin_url.lower():
                linkedin_url = ""
            # Don't SAVE the stored website for Indian entities (may be global parent's site),
            # but still USE it as a domain hint for LinkedIn search below.
            found_website = ""

        # Step 1 — Resolve LinkedIn URL
        # Priority: (a) HTML extraction from website → (b) domain-based DDGS → (c) name-based DDGS
        if not linkedin_url:
            # (a) Try extracting LinkedIn link from the company's own website HTML
            if not is_indian and stored_website:
                try:
                    r = requests.get(
                        stored_website if stored_website.startswith("http") else "https://" + stored_website,
                        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
                        timeout=12, allow_redirects=True
                    )
                    linkedin_url = extract_linkedin_url_from_html(r.text)
                    if linkedin_url: _li_url_source = "html"
                    if not linkedin_url and openrouter_key:
                        linkedin_url = extract_linkedin_url_with_qwen3(r.text, company_name, openrouter_key)
                        if linkedin_url: _li_url_source = "html"
                except Exception as e:
                    print(f"Website fetch for autofill: {e}")

            # If still no website and not Indian, discover it first
            if not is_indian and not stored_website:
                found_website = search_company_website(search_name) or ""
                stored_website = found_website

        # (b) Domain-based DDGS search — works for BOTH Indian and non-Indian entities.
        #     Uses stored_website (the company's real domain) even when found_website is cleared.
        #     This avoids name-search mismatches (e.g. "DIAGNAL (P) Ltd" → G3G).
        if not linkedin_url and stored_website:
            linkedin_url = search_linkedin_url_by_domain(stored_website) or ""
            if linkedin_url: _li_url_source = "domain"

        # (c) Name-based search — last resort, most likely to match wrong entity
        if not linkedin_url:
            linkedin_url = search_linkedin_url_direct(search_name) or ""
            if linkedin_url: _li_url_source = "name"

        if not linkedin_url:
            return {"success": False, "filled": [], "update": {}, "linkedin_url": None,
                    "message": "Could not find a LinkedIn page for this company. Try adding the LinkedIn URL manually on the card."}

        # Step 2 — Scrape LinkedIn
        li = scrape_linkedin_data(linkedin_url, li_cookie=li_cookie)

        # Domain cross-check — applies to ALL sources including stored URLs.
        # A stored LinkedIn URL may have been auto-saved from a previous wrong search.
        # We always verify the scraped company's website matches the stored domain.
        if stored_website:
            def _root_domain(url):
                try:
                    from urllib.parse import urlparse
                    host = urlparse(url if "://" in url else "https://" + url).netloc
                    host = host.replace("www.", "").split(":")[0].lower()
                    parts = host.split(".")
                    return ".".join(parts[-2:]) if len(parts) >= 2 else host
                except Exception:
                    return ""
            _stored_root = _root_domain(stored_website)
            # Check 1: website domain mismatch (only when LinkedIn has a website listed)
            if li.get("website"):
                _scraped_root = _root_domain(li.get("website", ""))
                if _stored_root and _scraped_root and _stored_root != _scraped_root:
                    # Clear the wrong stored LinkedIn URL so future searches start fresh
                    if _li_url_source == "stored":
                        supabase.table("companies").update({"linkedin_url": None}).eq("id", company_id).execute()
                    return {
                        "success": False, "filled": [], "update": {}, "linkedin_url": None,
                        "message": (
                            f"The LinkedIn page found has website \"{li.get('website')}\" "
                            f"but this company's domain is \"{stored_website}\" — wrong match. "
                            "The saved LinkedIn URL has been cleared. "
                            "Please paste the correct LinkedIn URL via Edit on the card."
                        ),
                    }
            # Check 2: LinkedIn slug vs. stored domain core (fallback when LinkedIn has no website)
            _slug_match = _re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', linkedin_url or '')
            if _slug_match and _stored_root:
                _dom_core = _stored_root.split(".")[0]  # e.g. "way" from "way.com"
                _slug = _slug_match.group(1).lower().replace("-", "")
                if len(_dom_core) >= 3 and len(_slug) >= 3:
                    if _dom_core not in _slug and _slug not in _dom_core:
                        if _li_url_source == "stored":
                            supabase.table("companies").update({"linkedin_url": None}).eq("id", company_id).execute()
                        return {
                            "success": False, "filled": [], "update": {}, "linkedin_url": None,
                            "message": (
                                f"The LinkedIn page \"{linkedin_url}\" doesn't match "
                                f"the expected domain \"{stored_website}\" — wrong match. "
                                "The saved LinkedIn URL has been cleared. "
                                "Please paste the correct LinkedIn URL via Edit on the card."
                            ),
                        }

        # If LinkedIn was blocked, try web search snippet fallback
        if not any([li.get("followers"), li.get("employee_count"), li.get("description")]):
            try:
                from .company_prefill import _web_search
                import re as _re2
                for sr in _web_search(f'"{company_name}" linkedin followers employees', count=5):
                    body = sr.get("body", "")
                    if not li.get("followers"):
                        m = _re2.search(r'([\d,]+)\s*followers', body, _re2.I)
                        if m: li["followers"] = m.group(0).strip()
                    if not li.get("description") and len(body) > 40:
                        li["description"] = body[:280]
                    if li.get("followers") and li.get("description"): break
            except Exception:
                pass

        # ProxyCurl fallback — fills industry, founded, specialties when HTML scrape misses them
        # (LinkedIn hides these from unauthenticated page views; ProxyCurl returns structured data)
        _pcurl_key = os.environ.get("PROXYCURL_API_KEY", "")
        missing_structured = not li.get("industry") or not li.get("founded") or not li.get("specialties")
        if _pcurl_key and missing_structured:
            try:
                pc_res = requests.get(
                    "https://nubela.co/proxycurl/api/linkedin/company",
                    params={"url": linkedin_url, "use_cache": "if-present", "fallback_to_cache": "on-error"},
                    headers={"Authorization": f"Bearer {_pcurl_key}"},
                    timeout=15,
                )
                if pc_res.status_code == 200:
                    pc = pc_res.json()
                    if not li.get("industry") and pc.get("industry"):
                        li["industry"] = pc["industry"]
                    if not li.get("founded") and pc.get("founded_year"):
                        li["founded"] = str(pc["founded_year"])
                    if not li.get("specialties") and pc.get("specialities"):
                        sp = pc["specialities"]
                        li["specialties"] = ", ".join(str(s) for s in sp) if isinstance(sp, list) else str(sp)
                    if not li.get("followers") and pc.get("follower_count"):
                        li["followers"] = f"{pc['follower_count']:,} followers"
                    if not li.get("employee_count") and pc.get("company_size_on_linkedin"):
                        li["employee_count"] = str(pc["company_size_on_linkedin"])
                    if not li.get("description") and pc.get("description"):
                        li["description"] = pc["description"]
                    if not li.get("location") and pc.get("hq"):
                        hq = pc["hq"]
                        parts = [hq.get("city"), hq.get("state"), hq.get("country")]
                        li["location"] = ", ".join(p for p in parts if p)
            except Exception:
                pass

        # Groq inference fallback — fills remaining blanks when ProxyCurl key is absent.
        # Uses the description we already scraped to infer industry, founded, specialties.
        _groq_key_li = os.environ.get("GROQ_API_KEY", "")
        # Only use description scraped from LinkedIn — never fall back to stored description
        # (stored descriptions may be user notes / LinkedIn post snippets, not company info)
        _desc_li = li.get("description") or ""
        if _groq_key_li and _desc_li and (not li.get("industry") or not li.get("founded") or not li.get("specialties")):
            try:
                import json as _json_li
                _li_prompt = (
                    f'Company: {company_name}\nDescription: {_desc_li[:400]}\n\n'
                    'Extract these fields. Be specific and concise.\n'
                    '- industry: industry name (e.g. "Software Development", "Financial Services", "Travel & Tourism")\n'
                    '- founded: 4-digit founding year only (omit if unsure)\n'
                    '- specialties: 3-5 comma-separated specialty areas based on what the company does\n\n'
                    'Respond ONLY as JSON: {"industry":"...","founded":"...","specialties":"..."}\n'
                    'Use null for fields you are not confident about.'
                )
                _g = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {_groq_key_li}", "Content-Type": "application/json"},
                    json={"model": "llama-3.1-8b-instant",
                          "messages": [{"role": "user", "content": _li_prompt}],
                          "max_tokens": 120, "temperature": 0.1},
                    timeout=10,
                )
                if _g.status_code == 200:
                    _raw_li = _g.json()["choices"][0]["message"]["content"].strip()
                    _m_li = _re.search(r'\{[^}]+\}', _raw_li, _re.DOTALL)
                    if _m_li:
                        _ex = _json_li.loads(_m_li.group(0))
                        if not li.get("industry") and _ex.get("industry") and _ex["industry"] not in (None, "null"):
                            li["industry"] = str(_ex["industry"])
                        if not li.get("founded") and _ex.get("founded") and str(_ex["founded"]) not in ("", "None", "null"):
                            _yr = str(_ex["founded"]).strip()
                            # Only accept years that appear literally in the description — prevents hallucination
                            if _re.match(r'^\d{4}$', _yr) and 1800 <= int(_yr) <= 2030 and _yr in _desc_li:
                                li["founded"] = _yr
                        if not li.get("specialties") and _ex.get("specialties") and _ex["specialties"] not in (None, "null"):
                            li["specialties"] = str(_ex["specialties"])
            except Exception:
                pass

        # Generate a clean one-liner tagline from the real LinkedIn description using Groq
        if _groq_key_li and li.get("description") and not li.get("tagline"):
            try:
                _tg = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {_groq_key_li}", "Content-Type": "application/json"},
                    json={"model": "llama-3.1-8b-instant",
                          "messages": [{"role": "user", "content": (
                              f"Write ONE sentence (max 15 words) summarizing what this company does.\n"
                              f"Company: {company_name}\nDescription: {li['description'][:500]}\n"
                              "Respond with ONLY the sentence, no quotes."
                          )}],
                          "max_tokens": 60, "temperature": 0.2},
                    timeout=8,
                )
                if _tg.status_code == 200:
                    _tagline = _tg.json()["choices"][0]["message"]["content"].strip().strip('"').strip("'").rstrip(".")
                    if len(_tagline) > 10:
                        li["tagline"] = _tagline
            except Exception:
                pass

        # Step 3 — Website: prefer stored website over LinkedIn-scraped to avoid aggregator sites
        # (e.g. LinkedIn page for SS&C shows ampliz.com, but stored website ssctech.com is correct)
        if not is_indian and not found_website and not li.get("website"):
            from .company_prefill import _web_search, _SKIP_DOMAINS, _domain_is_relevant, _guess_domain
            from urllib.parse import urlparse as _up2

            # 3a: Derive domain from LinkedIn URL slug — most reliable when URL is stored.
            # "way-com" → "way.com", "beagle-security-com" → "beagle-security.com", etc.
            _slug_m = _re.search(r'linkedin\.com/company/([a-zA-Z0-9-]+)', linkedin_url or '')
            if _slug_m:
                _slug = _slug_m.group(1).lower()
                _tlds = ['com', 'io', 'co', 'ai', 'net', 'app']
                for _tld in _tlds:
                    if _slug.endswith(f'-{_tld}') and len(_slug) > len(_tld) + 1:
                        _candidate = _slug[: -(len(_tld) + 1)] + '.' + _tld
                        try:
                            _r2 = requests.get(
                                f'https://{_candidate}', timeout=6, allow_redirects=True,
                                headers={'User-Agent': 'Mozilla/5.0'}, stream=True
                            )
                            _r2.close()
                            if _r2.status_code < 500:
                                found_website = f'https://{_candidate}'
                        except Exception:
                            pass
                        break  # only one tld suffix per slug

            # 3b: Direct domain guess — HTTP-verifies the domain exists, no web search needed.
            # For "Way" this tries way.com HEAD request → 200/403 → done. Much more reliable than
            # DDGS which accepts any domain containing "way" (e.g. getaway.com, oneway.com).
            if not found_website:
                found_website = _guess_domain(company_name) or ""

            # 3b: Contextual DDGS search using LinkedIn location/industry as disambiguators
            if not found_website:
                _li_loc = (li.get("location") or "").split(",")[0].strip()
                _li_ind = (li.get("industry") or "")
                if _li_loc or _li_ind:
                    _hint = " ".join(h for h in [_li_loc, _li_ind] if h)[:60]
                    for _q in [f'"{company_name}" {_hint} official website', f'"{company_name}" {_hint} site']:
                        for _r in _web_search(_q, count=6):
                            _href = _r.get('href', '')
                            if not _href:
                                continue
                            _dom2 = _up2(_href).netloc.replace('www.', '')
                            if any(_dom2 == s or _dom2.endswith('.' + s) for s in _SKIP_DOMAINS):
                                continue
                            # Require domain to START with company name to avoid substring traps
                            # ("way" in "getaway" is True — we want "getaway".startswith("way") = False)
                            _dom_core = _dom2.split('.')[0]
                            _name_lc = re.sub(r'[^a-z0-9]', '', company_name.lower())
                            if _dom_core == _name_lc or _dom_core.startswith(_name_lc) or company_name.lower() in _r.get('title', '').lower():
                                found_website = _href
                                break
                        if found_website:
                            break

            # 3c: Plain name search fallback (already tries _guess_domain internally, skip that)
            if not found_website:
                for _q in [f'"{company_name}" official website', f'{company_name} company site']:
                    for _r in _web_search(_q, count=6):
                        _href = _r.get('href', '')
                        if not _href:
                            continue
                        _dom2 = _up2(_href).netloc.replace('www.', '')
                        if any(_dom2 == s or _dom2.endswith('.' + s) for s in _SKIP_DOMAINS):
                            continue
                        if _domain_is_relevant(_dom2, company_name) or company_name.lower() in _r.get('title', '').lower():
                            found_website = _href
                            break
                    if found_website:
                        break
        # For Indian entities found_website is already "" (cleared above), so li.get("website") is used
        website_to_save = (found_website if not is_indian else "") or li.get("website") or ""

        # Step 4 — Build update.
        # "↯ Fill LI" is an explicit user action — LinkedIn is authoritative for its own fields,
        # so always overwrite (not just fill-empty) for all LinkedIn-sourced data.
        # Website is the exception: we keep the existing website unless it's empty, because
        # LinkedIn sometimes lists aggregator/data-broker URLs instead of the real site.
        update_data = {}
        if linkedin_url:
            update_data["linkedin_url"] = linkedin_url
        if li.get("location"):
            update_data["headquarters"] = li["location"]
        if li.get("followers"):
            update_data["followers"] = li["followers"]
        if li.get("employee_count"):
            update_data["size"] = str(li["employee_count"])
        if li.get("description"):
            update_data["description"] = li["description"]
        if li.get("phone"):
            update_data["phone"] = li["phone"]
        if li.get("founded"):
            update_data["founded"] = li["founded"]
        if li.get("specialties"):
            update_data["specialties"] = li["specialties"]
        if li.get("tagline"):
            update_data["tagline"] = li["tagline"]
        # Website: only set when empty (or Indian entity where stored URL was the global parent)
        if website_to_save and (not company.get("website") or is_indian):
            update_data["website"] = website_to_save

        # Always persist what LinkedIn's page listed as their website — even an empty sentinel.
        # The frontend checkCompanyAccuracy() uses this field to verify LinkedIn URL correctness:
        # if linkedin_website ≠ company.website it flags the LinkedIn URL as a wrong-entity match.
        if li.get("website"):
            update_data["linkedin_website"] = li["website"]
        elif any([li.get("followers"), li.get("description"), li.get("employee_count")]):
            # LinkedIn was reachable but listed no website — save "" sentinel so accuracy check
            # knows "we looked and found nothing" vs "we never checked"
            update_data["linkedin_website"] = ""

        # Save raw LinkedIn industry value (always overwrite — Fill LI is authoritative)
        if li.get("industry"):
            update_data["industry"] = li["industry"]

        # Classification from LinkedIn industry (mirrors _LI_CLASS_MAP in _autofill_one)
        current_class = company.get("classification") or "Unclassified"
        if li.get("industry") and current_class == "Unclassified":
            _LI_CLASS_MAP = {
                'software development': 'IT Services', 'information technology': 'IT Services',
                'it services': 'IT Services', 'computer software': 'SaaS', 'internet': 'SaaS',
                'financial services': 'Fintech', 'banking': 'Banking', 'insurance': 'Insurance',
                'hospital': 'Healthtech', 'health': 'Healthtech', 'e-learning': 'Edtech',
                'education': 'Edtech', 'logistics': 'Logistics', 'transportation': 'Logistics',
                'retail': 'Retail', 'real estate': 'Real Estate', 'venture capital': 'VC / Investment',
                'private equity': 'VC / Investment', 'marketing': 'Media', 'broadcast': 'Media',
                'management consulting': 'Consulting', 'consulting': 'Consulting',
                'nonprofit': 'Non-profit', 'government': 'Government',
                'security': 'Cybersecurity', 'cybersecurity': 'Cybersecurity',
                'manufacturing': 'Manufacturing', 'e-commerce': 'E-commerce',
                'business consulting': 'Consulting', 'staffing': 'IT Services',
                'outsourcing': 'IT Services',
            }
            ind_lower = li["industry"].lower()
            mapped = next((v for k, v in _LI_CLASS_MAP.items() if k in ind_lower), None)
            if mapped:
                update_data["classification"] = mapped

        if update_data:
            supabase.table("companies").update(update_data).eq("id", company_id).eq("user_id", user_id).execute()

        posthog.capture(user_id, "company_autofilled_linkedin", {
            "fields_filled": list(update_data.keys()),
            "had_linkedin_url": bool(company.get("linkedin_url")),
        })
        return {
            "success": True,
            "filled": list(update_data.keys()),
            "update": update_data,
            "linkedin_url": linkedin_url,
            "classification": update_data.get("classification"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── FETCH FUNDING ────────────────────────────────────────────

@router.post("/companies/{company_id}/fetch-funding")
async def fetch_company_funding(company_id: str, authorization: str = Header(...)):
    """Search the web for company funding data and save to the revenue field."""
    user_id = get_user_id(authorization)
    co_res = supabase.table("companies").select("id,name,website").eq("id", company_id).eq("user_id", user_id).limit(1).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    company = co_res.data[0]
    name = company.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Company name not set")

    try:
        from ddgs import DDGS
        import re as _fre
        import json as _fjson

        snippets = []
        queries = [
            f'"{name}" total funding raised "Series" OR "Seed" OR "seed round" OR "pre-seed"',
            f'site:crunchbase.com "{name}" funding',
            f'"{name}" investment round raised million',
        ]
        with DDGS() as ddgs:
            for q in queries:
                try:
                    for r in ddgs.text(q, max_results=4):
                        snippets.append((r.get("title", "") + " " + r.get("body", "")).strip())
                    if len(snippets) >= 8:
                        break
                except Exception:
                    continue

        if not snippets:
            return {"success": False, "message": "No funding data found"}

        combined = " | ".join(snippets[:8])[:2500]
        groq_key = os.environ.get("GROQ_API_KEY", "")
        if not groq_key:
            return {"success": False, "message": "Groq key not configured"}

        import requests as _freq
        gres = _freq.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": (
                    f"Extract funding info for company '{name}' from these web snippets:\n\n{combined}\n\n"
                    'Return ONLY JSON: {"stage":"Seed/Series A/Series B/etc or null","amount":"e.g. $5M or null","investors":"main investor names or null"}\n'
                    "Use null for fields that are not clearly stated. Only include data that is specifically about this company."
                )}],
                "max_tokens": 150,
                "temperature": 0.1,
            },
            timeout=12,
        )
        if gres.status_code != 200:
            return {"success": False, "message": "AI extraction failed"}

        raw = gres.json()["choices"][0]["message"]["content"].strip()
        m = _fre.search(r'\{[^}]+\}', raw, _fre.DOTALL)
        if not m:
            return {"success": False, "message": "Could not parse funding response"}

        data = _fjson.loads(m.group(0))
        stage  = (data.get("stage")     or "").strip()
        amount = (data.get("amount")    or "").strip()
        investors = (data.get("investors") or "").strip()

        if not stage and not amount:
            return {"success": False, "message": "No clear funding data found for this company"}

        parts = [p for p in [stage, amount] if p and p not in ("null", "None")]
        if investors and investors not in ("null", "None"):
            parts.append(f"· {investors}")
        funding_str = " ".join(parts)

        supabase.table("companies").update({"revenue": funding_str}).eq("id", company_id).eq("user_id", user_id).execute()
        posthog.capture(user_id, "company_funding_fetched", {"company": name})
        return {"success": True, "funding": funding_str}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── DEEP ENRICH ──────────────────────────────────────────────

@router.post("/companies/{company_id}/deep-enrich")
async def deep_enrich_company(company_id: str, authorization: str = Header(...)):
    """Run all 8 enrichment jobs for a company: tech stack, jobs, email pattern,
    news, revenue estimate, social profiles, traffic estimate, review presence."""
    user_id = get_user_id(authorization)
    co_res = supabase.table("companies").select(
        "id,name,website,size,classification,industry,linkedin_url"
    ).eq("id", company_id).eq("user_id", user_id).limit(1).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    company = co_res.data[0]
    name = company.get("name", "").strip()
    website = (company.get("website") or "").strip()
    if not website.startswith("http"):
        website = "https://" + website if website else ""
    emp = company.get("size") or ""
    industry = company.get("industry") or ""
    classification = company.get("classification") or ""

    from urllib.parse import urlparse as _deup
    domain = ""
    if website:
        try:
            _h = _deup(website).netloc.lower().replace("www.", "")
            domain = _h
        except Exception:
            pass

    from .company_enrichment import (
        detect_tech_stack, fetch_job_openings, detect_email_pattern,
        fetch_recent_news, estimate_revenue, extract_social_profiles,
        fetch_traffic_estimate, fetch_review_presence,
    )
    import concurrent.futures as _cf

    results: dict = {}
    errors: dict = {}

    def _run(key, fn, *args):
        try:
            return key, fn(*args), None
        except Exception as e:
            return key, None, str(e)

    jobs_map = {
        "tech_stack":      (detect_tech_stack,      website),
        "job_openings":    (fetch_job_openings,      website, name),
        "email_pattern":   (detect_email_pattern,    domain),
        "recent_news":     (fetch_recent_news,       name, domain, website),
        "revenue_estimate":(estimate_revenue,        emp, industry, classification),
        "social_profiles": (extract_social_profiles, website),
        "traffic_estimate":(fetch_traffic_estimate,  domain),
        "review_presence": (fetch_review_presence,   name, domain),
    }

    with _cf.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(_run, k, fn, *args): k
            for k, (fn, *args) in jobs_map.items()
        }
        for fut in _cf.as_completed(futures):
            key, val, err = fut.result()
            if err:
                errors[key] = err
            elif val is not None and val != "" and val != [] and val != {}:
                results[key] = val

    # Persist all collected results + timestamp
    if results:
        import datetime as _dt
        results["enriched_at"] = _dt.datetime.utcnow().isoformat()
        supabase.table("companies").update(results).eq("id", company_id).eq("user_id", user_id).execute()

    posthog.capture(user_id, "company_deep_enriched", {
        "company": name,
        "fields_enriched": list(results.keys()),
        "errors": list(errors.keys()),
    })
    return {"success": True, "enriched": results, "errors": errors}


# ─── BULK DEEP ENRICH ─────────────────────────────────────────

@router.post("/companies/bulk-deep-enrich")
async def bulk_deep_enrich_companies(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Run all 8 enrichment jobs for multiple companies in parallel (5 workers)."""
    user_id = get_user_id(authorization)
    _check_user_rate_limit(user_id, "bulk-deep-enrich", limit=3, window_minutes=60)
    company_ids = payload.get("company_ids", [])

    import threading as _bde_threading
    import queue as _bde_queue
    import json as _bde_json
    import datetime as _bde_dt
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from fastapi.responses import StreamingResponse
    from urllib.parse import urlparse as _bde_up

    from .company_enrichment import (
        detect_tech_stack, fetch_job_openings, detect_email_pattern,
        fetch_recent_news, estimate_revenue, extract_social_profiles,
        fetch_traffic_estimate, fetch_review_presence,
    )

    try:
        if company_ids:
            co_res = supabase.table("companies").select(
                "id,name,website,size,classification,industry"
            ).in_("id", company_ids).eq("user_id", user_id).execute()
        else:
            co_res = supabase.table("companies").select(
                "id,name,website,size,classification,industry"
            ).eq("user_id", user_id).execute()
        companies_list = co_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    def _enrich_one(company):
        name = company.get("name", "").strip()
        website = (company.get("website") or "").strip()
        if website and not website.startswith("http"):
            website = "https://" + website
        emp = company.get("size") or ""
        industry = company.get("industry") or ""
        classification = company.get("classification") or ""
        domain = ""
        if website:
            try:
                domain = _bde_up(website).netloc.lower().replace("www.", "")
            except Exception:
                pass

        results = {}
        jobs_map = {
            "tech_stack":      (detect_tech_stack,      website),
            "job_openings":    (fetch_job_openings,      website, name),
            "email_pattern":   (detect_email_pattern,    domain),
            "recent_news":     (fetch_recent_news,       name, domain, website),
            "revenue_estimate":(estimate_revenue,        emp, industry, classification),
            "social_profiles": (extract_social_profiles, website),
            "traffic_estimate":(fetch_traffic_estimate,  domain),
            "review_presence": (fetch_review_presence,   name, domain),
        }
        import concurrent.futures as _cf2
        with _cf2.ThreadPoolExecutor(max_workers=8) as inner:
            futs = {inner.submit(fn, *args): k for k, (fn, *args) in jobs_map.items()}
            for fut in _cf2.as_completed(futs):
                k = futs[fut]
                try:
                    val = fut.result()
                    if val is not None and val != "" and val != [] and val != {}:
                        results[k] = val
                except Exception:
                    pass

        if results:
            results["enriched_at"] = _bde_dt.datetime.utcnow().isoformat()
            supabase.table("companies").update(results).eq("id", company["id"]).eq("user_id", user_id).execute()

        return {"id": company["id"], "name": name, "success": True, "fields": list(results.keys())}

    total = len(companies_list)
    result_queue = _bde_queue.Queue()

    def _run_pool():
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(_enrich_one, c): c for c in companies_list}
            for fut in as_completed(futures):
                try:
                    result_queue.put(fut.result())
                except Exception as e:
                    result_queue.put({"success": False, "fields": [], "message": str(e)})
        result_queue.put(None)

    _bde_threading.Thread(target=_run_pool, daemon=True).start()

    import asyncio as _bde_asyncio

    async def event_stream():
        completed = 0
        loop = _bde_asyncio.get_running_loop()
        while True:
            result = await loop.run_in_executor(None, result_queue.get)
            if result is None:
                break
            completed += 1
            result["_progress"] = {"completed": completed, "total": total}
            yield _bde_json.dumps(result) + "\n"
        posthog.capture(user_id, "companies_bulk_deep_enriched", {"total": total})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# ─── BULK AUTOFILL (parallel) ─────────────────────────────────

@router.post("/companies/bulk-autofill")
async def bulk_autofill_companies(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Autofill data for multiple companies in parallel (20 workers)."""
    user_id = get_user_id(authorization)
    _check_user_rate_limit(user_id, "bulk-autofill", limit=5, window_minutes=60)
    company_ids = payload.get("company_ids", [])

    import threading as _threading
    from concurrent.futures import ThreadPoolExecutor, as_completed

    from .website_analyzer import fetch_website_content, classify_company_type_rules

    # Fetch target companies
    try:
        if company_ids:
            co_res = supabase.table("companies").select("*").in_("id", company_ids).eq("user_id", user_id).execute()
        else:
            co_res = supabase.table("companies").select("*").eq("user_id", user_id).execute()
        companies = co_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    import re as _re_mod
    from .company_prefill import (
        scrape_linkedin_data as _scrape_li,
        search_linkedin_url_by_domain, search_linkedin_url_direct,
        search_company_website, clean_name_for_search,
    )

    def _ddgs_run(fn, *args, timeout=15):
        """Run fn under _DDGS_SEM (max 3 concurrent DDGS calls) with a per-call timeout.

        The semaphore is acquired in the CALLING thread so the timeout only measures
        the actual fn() execution, not time spent waiting for the semaphore slot.
        With 20 pool workers and Semaphore(3), acquiring the semaphore in the thread
        (old approach) meant the 15s timeout could expire before fn() ever started.
        """
        with _DDGS_SEM:
            result = [None]
            def _worker():
                try:
                    result[0] = fn(*args)
                except Exception:
                    pass
            t = _threading_mod.Thread(target=_worker, daemon=True)
            t.start()
            t.join(timeout=timeout)
            return result[0]

    # ── Generic business words that appear on any company site ───────────────
    _SITE_GENERIC = frozenset({
        'pvt', 'ltd', 'inc', 'llc', 'corp', 'private', 'limited',
        'the', 'and', 'for', 'with', 'india', 'global', 'group',
        'company', 'business', 'technology', 'technologies',
        'solutions', 'services', 'systems', 'digital', 'software',
        'enterprise', 'consulting', 'management', 'international',
        'national', 'associates', 'partners', 'infotech', 'infosystems',
    })

    def _sig_words(company_name: str) -> list:
        """Significant (non-generic) words from a company name, same set as _SITE_GENERIC."""
        clean = _re_mod.sub(r'[^a-z0-9 ]', ' ', clean_name_for_search(company_name).lower())
        return [w for w in clean.split() if len(w) > 2 and w not in _SITE_GENERIC]

    def _name_is_distinctive(company_name: str) -> bool:
        """Return True if the name is specific enough that a LinkedIn slug match is trustworthy.

        Generic names like "Apex" or "Prime Tech" match hundreds of companies on LinkedIn.
        Distinctive names like "Mindzen" or "Cinch Business Solutions" are unlikely to collide.
        Rule: at least 2 significant words, OR 1 word of length >= 7.
        """
        words = _sig_words(company_name)
        return len(words) >= 2 or (len(words) == 1 and len(words[0]) >= 7)

    def _website_matches_company(company_name: str, website_data: dict) -> bool:
        """Return True if website content plausibly belongs to this company.

        Prevents saving/using a DDGS-discovered website that actually belongs to a
        different company (e.g. 'Cinch Business Solutions' → greencirclelife.com).
        Requires at least one non-generic name word to appear on the page.
        """
        if not website_data:
            return False
        page_text = " ".join(filter(None, [
            website_data.get("title", ""),
            website_data.get("meta_description", ""),
            website_data.get("hero", ""),
            website_data.get("first_para", ""),
        ])).lower()
        clean = _re_mod.sub(r'[^a-z0-9 ]', ' ', clean_name_for_search(company_name).lower())
        words = [w for w in clean.split() if len(w) > 2 and w not in _SITE_GENERIC]
        if not words:
            return True  # Name is entirely generic — cannot validate, accept
        return any(w in page_text for w in words[:4])

    def _linkedin_slug_matches(company_name: str, linkedin_url: str) -> bool:
        """Validate that a LinkedIn URL slug plausibly belongs to this company.

        LinkedIn slugs are derived from company names, so the slug for
        'Cinch Business Solutions' would be 'cinch-business-solutions' or similar,
        not 'green-circle-life'. At least one non-generic name word must appear
        in the slug (or the URL path at minimum).
        """
        m = _re_mod.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', linkedin_url)
        if not m:
            return False
        slug = m.group(1).lower().replace('-', ' ').replace('_', ' ')
        clean = _re_mod.sub(r'[^a-z0-9 ]', ' ', clean_name_for_search(company_name).lower())
        words = [w for w in clean.split() if len(w) > 2 and w not in _SITE_GENERIC]
        if not words:
            return True  # Generic name — can't validate, accept
        return any(w in slug for w in words[:4])

    def _ddgs_linkedin_snippet(company_name: str, li_slug: str = "") -> dict:
        """Pull employee count + followers from DDGS search snippets for a LinkedIn page.

        LinkedIn blocks direct scraping without login. DDGS snippets for
        linkedin.com/company/slug frequently contain "X followers" and "Y employees"
        from Google/Bing knowledge panels — no login required.
        """
        result = {}
        try:
            from ddgs import DDGS
            queries = []
            if li_slug:
                queries.append(f"site:linkedin.com/company/{li_slug}")
            queries.append(f'"{company_name}" linkedin employees followers')
            with DDGS() as ddgs:
                for q in queries:
                    try:
                        for r in ddgs.text(q, max_results=4):
                            body = " ".join(filter(None, [
                                r.get("body"), r.get("title"), r.get("description"),
                            ]))
                            if not result.get("followers"):
                                m = _re_mod.search(r'([\d,]+(?:\.\d+)?[KMk]?)\s*followers', body, _re_mod.I)
                                if m:
                                    result["followers"] = m.group(0).strip()
                            if not result.get("employee_count"):
                                # Handles: "1,234 employees", "11-50 employees",
                                # "5000 & Above employees", "501+ employees"
                                m = _re_mod.search(
                                    r'(\d[\d,]*(?:-[\d,]+)?(?:\+)?)'
                                    r'(?:\s*[&+]\s*(?:above|more|plus|and above))?\s*employees?',
                                    body, _re_mod.I,
                                )
                                if m:
                                    result["employee_count"] = m.group(1).replace(",", "")
                            if not result.get("headquarters"):
                                # LinkedIn snippet format: "City, Country · Industry · X employees"
                                m = _re_mod.search(r'·\s*([A-Z][^·|<]{4,50}(?:India|US|UAE|UK|Singapore|Malaysia|Canada|Australia))\s*[·|]', body)
                                if m:
                                    result["headquarters"] = m.group(1).strip()
                            if result.get("followers") or result.get("employee_count"):
                                return result
                    except Exception:
                        continue
        except Exception:
            pass
        return result

    def _ddgs_general_info(company_name: str, out: dict, need_desc: bool, need_hq: bool) -> None:
        """Write description / headquarters into *out* from DDGS company snippets.

        Targets Tracxn, Clutch, LinkedIn, and similar business directories whose
        search snippets typically include a one-liner description and city/country.
        """
        clean = clean_name_for_search(company_name)
        try:
            from ddgs import DDGS
            queries = [
                f'"{clean}" company description headquarters',
                f'{clean} IT company Kerala India about',
            ]
            with DDGS() as ddgs:
                for q in queries:
                    try:
                        for r in ddgs.text(q, max_results=5):
                            body  = " ".join(filter(None, [r.get("body"), r.get("title")]))
                            href  = r.get("href", "")
                            # Skip results unlikely to be about this specific company
                            if clean.lower().split()[0] not in body.lower():
                                continue
                            if need_desc and not out.get("description"):
                                # Prefer sentences that sound like a company description
                                m = _re_mod.search(
                                    r'(?:is a|is an|provides?|offers?|develops?|builds?|specializes? in)'
                                    r'[^.!?]{20,200}[.!?]',
                                    body, _re_mod.I,
                                )
                                if m:
                                    out["description"] = m.group(0).strip()
                            if need_hq and not out.get("headquarters"):
                                m = _re_mod.search(
                                    r'(?:headquartered? in|located in|based in|offices? in|HQ[:\s]+)'
                                    r'\s*([A-Z][a-zA-Z\s,]{4,50}?)(?:[,.]|\s*[-–]|\s*\|)',
                                    body, _re_mod.I,
                                )
                                if m:
                                    out["headquarters"] = m.group(1).strip()
                            if (not need_desc or out.get("description")) and \
                               (not need_hq  or out.get("headquarters")):
                                return
                    except Exception:
                        continue
        except Exception:
            pass

    def _autofill_one(company: dict) -> dict:
        company_name = company.get("name", "")
        ws_url       = company.get("website") or ""
        if ws_url and not ws_url.startswith("http"):
            ws_url = "https://" + ws_url

        needs_desc      = not company.get("description")
        needs_hq        = not company.get("headquarters")
        needs_type      = not company.get("company_type")
        needs_site      = not company.get("website")
        needs_linkedin  = not company.get("linkedin_url")
        needs_size      = not company.get("size")
        needs_followers = not company.get("followers")
        # A correct LinkedIn company profile always lists the real website — if it
        # disagrees with our stored website, that's a strong sign of a wrong match.
        # Captured once per company (stored as "" if LinkedIn lists none) so this
        # doesn't force a re-scrape on every future run.
        needs_li_verify = bool(company.get("linkedin_url")) and company.get("linkedin_website") is None

        if not any([needs_desc, needs_hq, needs_type, needs_site,
                    needs_linkedin, needs_size, needs_followers, needs_li_verify]):
            return {"id": company["id"], "name": company_name, "success": True,
                    "filled": [], "update": {}, "message": "already complete"}

        update_data = {}

        try:
            # ── Step 1: find official website via DDGS if missing ─────────────
            if needs_site and not ws_url:
                found = _ddgs_run(search_company_website, company_name, timeout=20)
                if found:
                    ws_url = found
                    update_data["website"] = ws_url

            # ── Step 1b: LinkedIn-first website discovery ─────────────────────
            # A correct LinkedIn company "About" section always lists the official
            # site. Searching LinkedIn by name is often MORE reliable than a raw
            # web search because the company itself controls the page.
            # Strategy:
            #   • Distinctive name (≥2 sig-words OR 1 word ≥7 chars) → trust the
            #     LinkedIn-listed website directly; it's highly unlikely to be wrong.
            #   • Ambiguous name (single short word like "Apex") → use the LinkedIn-
            #     listed website as a candidate but still validate its content against
            #     the company name before saving, matching multiple entities risk.
            # This runs when we still need both the website AND the LinkedIn URL, OR
            # when DDGS Step 1 returned nothing (ws_url is still empty).
            li_url = company.get("linkedin_url") or ""
            if needs_linkedin and (needs_site and not ws_url or (needs_site and not update_data.get("website"))):
                try:
                    _li_candidate = _ddgs_run(
                        search_linkedin_url_direct, clean_name_for_search(company_name)
                    ) or ""
                    if _li_candidate and _linkedin_slug_matches(company_name, _li_candidate):
                        # Scrape the LinkedIn page just for its About-section website
                        _li_data_early = _scrape_li(_li_candidate, fast=False, li_cookie=os.getenv("LI_SESSION_COOKIE", ""))
                        _li_ws_early = _li_data_early.get("website") or ""
                        if _li_ws_early:
                            if not _li_ws_early.startswith("http"):
                                _li_ws_early = "https://" + _li_ws_early
                            if _name_is_distinctive(company_name):
                                # Trust directly — no content-validation needed
                                ws_url = _li_ws_early
                                update_data["website"] = ws_url
                                update_data["linkedin_website"] = ws_url  # same source
                            else:
                                # Ambiguous name: treat as candidate, validate in Step 2
                                ws_url = _li_ws_early
                                update_data["website"] = ws_url
                                update_data["linkedin_website"] = _li_ws_early
                                # _website_matches_company check will run in Step 2
                        # Either way, lock in the LinkedIn URL we found
                        li_url = _li_candidate
                        update_data["linkedin_url"] = li_url
                        needs_linkedin = False  # don't re-search in Step 3
                except Exception:
                    pass

            # ── Step 2: scrape website ────────────────────────────────────────
            # fast=False (5s connect / 12s read) — fast=True's 2s kills ~80% of
            # Indian IT sites. 20 workers × 12s ≈ 10 min for 1000 companies max.
            website_data = None
            _ws_url_used = None
            if ws_url:
                website_data = fetch_website_content(ws_url, fast=False)
                _ws_url_used = ws_url
                if not website_data:
                    parsed = urlparse(ws_url)
                    if not parsed.netloc.startswith("www."):
                        _www = parsed.scheme + "://www." + parsed.netloc + parsed.path
                        website_data = fetch_website_content(_www, fast=False)
                        if website_data: _ws_url_used = _www
                if not website_data and ws_url.startswith("http://"):
                    _https = "https://" + ws_url[7:]
                    website_data = fetch_website_content(_https, fast=False)
                    if website_data: _ws_url_used = _https

            # Accuracy guard: reject website if its content doesn't mention the
            # company name. Prevents "Cinch Business Solutions" → greencirclelife.com
            # style mismatches where DDGS returns the wrong domain.
            # Skipped when the website came directly from a validated LinkedIn About
            # page for a distinctive company name — that source is authoritative.
            _li_sourced_website = update_data.get("linkedin_website") == update_data.get("website") and bool(update_data.get("linkedin_website"))
            if website_data and needs_site and _ws_url_used and not _li_sourced_website:
                if not _website_matches_company(company_name, website_data):
                    website_data = None
                    _ws_url_used = None
                    # Retract the URL we were about to save — it's the wrong company's site
                    update_data.pop("website", None)
                    ws_url = ""  # don't use for LinkedIn domain search either

            if website_data:
                if needs_type:
                    ct, _ = classify_company_type_rules(website_data)
                    if ct:
                        update_data["company_type"] = ct
                if needs_desc:
                    desc = (website_data.get("meta_description") or
                            website_data.get("first_para") or
                            (website_data.get("hero", "")[:300].strip() or None))
                    if desc:
                        update_data["description"] = desc
                if needs_hq:
                    loc = website_data.get("location")
                    if loc:
                        update_data["headquarters"] = loc
                compliance = website_data.get("compliance_detected") or []
                if compliance and not company.get("compliance"):
                    update_data["compliance"] = ", ".join(compliance)

            # ── Step 3: LinkedIn URL ──────────────────────────────────────────
            # Prefer update_data["linkedin_url"] — may have been set by Step 1b.
            li_url = update_data.get("linkedin_url") or company.get("linkedin_url") or ""

            if needs_linkedin:
                # Tier 1: LinkedIn href already in scraped HTML (free, instant)
                if website_data and website_data.get("linkedin_url"):
                    candidate = website_data["linkedin_url"]
                    if _linkedin_slug_matches(company_name, candidate):
                        li_url = candidate

                # Tier 2: DDGS by domain — far more precise than name search
                if not li_url and ws_url:
                    candidate = _ddgs_run(search_linkedin_url_by_domain, ws_url) or ""
                    if candidate and _linkedin_slug_matches(company_name, candidate):
                        li_url = candidate

                # Tier 3: DDGS by company name (last resort)
                if not li_url:
                    candidate = _ddgs_run(
                        search_linkedin_url_direct, clean_name_for_search(company_name)
                    ) or ""
                    if candidate and _linkedin_slug_matches(company_name, candidate):
                        li_url = candidate

                if li_url:
                    update_data["linkedin_url"] = li_url

            # ── Step 4: scrape LinkedIn page (fast=False — all 4 UAs, 8s each) ─
            # Also captures website URL from LinkedIn about section. If we had no
            # website yet, use it to scrape for description/HQ/type. Otherwise it's
            # stored for cross-validation against the website we already have.
            if li_url and (needs_size or needs_followers or needs_hq or needs_desc or needs_site or needs_li_verify):
                try:
                    li_data = _scrape_li(li_url, fast=False, li_cookie=os.getenv("LI_SESSION_COOKIE", ""))
                    if li_data.get("followers") and needs_followers:
                        update_data["followers"] = li_data["followers"]
                    if li_data.get("employee_count") and needs_size:
                        update_data["size"] = str(li_data["employee_count"])
                    if li_data.get("location") and needs_hq and not update_data.get("headquarters"):
                        update_data["headquarters"] = li_data["location"]

                    # Description — LinkedIn's About Overview is authoritative; use directly
                    if li_data.get("description") and needs_desc and not update_data.get("description"):
                        update_data["description"] = li_data["description"]

                    # Phone from LinkedIn About (only if not already set from Maps)
                    if li_data.get("phone") and not company.get("phone") and not update_data.get("phone"):
                        update_data["phone"] = li_data["phone"]

                    # Founded year
                    if li_data.get("founded") and not company.get("founded"):
                        update_data["founded"] = li_data["founded"]

                    # Specialties
                    if li_data.get("specialties") and not company.get("specialties"):
                        update_data["specialties"] = li_data["specialties"]

                    # Tagline (company slogan from LinkedIn og:description)
                    if li_data.get("tagline") and not company.get("tagline"):
                        update_data["tagline"] = li_data["tagline"]

                    # Save raw LinkedIn industry value (always overwrite — Fill LI is authoritative)
                    if li_data.get("industry"):
                        update_data["industry"] = li_data["industry"]

                    # Industry → classification (if not already set)
                    if li_data.get("industry") and (not company.get("classification") or company.get("classification") == "Unclassified"):
                        _LI_CLASS_MAP = {
                            'software development': 'IT Services',
                            'information technology': 'IT Services',
                            'it services': 'IT Services',
                            'computer software': 'SaaS',
                            'internet': 'SaaS',
                            'financial services': 'Fintech',
                            'banking': 'Banking',
                            'insurance': 'Insurance',
                            'hospital': 'Healthtech',
                            'health': 'Healthtech',
                            'e-learning': 'Edtech',
                            'education': 'Edtech',
                            'logistics': 'Logistics',
                            'transportation': 'Logistics',
                            'retail': 'Retail',
                            'real estate': 'Real Estate',
                            'venture capital': 'VC / Investment',
                            'private equity': 'VC / Investment',
                            'marketing': 'Media',
                            'broadcast': 'Media',
                            'management consulting': 'Consulting',
                            'consulting': 'Consulting',
                            'nonprofit': 'Non-profit',
                            'government': 'Government',
                            'security': 'Cybersecurity',
                            'cybersecurity': 'Cybersecurity',
                            'manufacturing': 'Manufacturing',
                            'e-commerce': 'E-commerce',
                        }
                        ind_lower = (li_data.get("industry") or "").lower()
                        mapped = next((v for k, v in _LI_CLASS_MAP.items() if k in ind_lower), None)
                        if mapped:
                            update_data["classification"] = mapped

                    # LinkedIn about section often lists the official website.
                    # Use it to scrape for description/type/HQ if website was unknown,
                    # and always record it (even "" if absent) for accuracy cross-checks.
                    li_website = li_data.get("website") or ""
                    if li_website and not li_website.startswith("http"):
                        li_website = "https://" + li_website
                    # Always capture LinkedIn's stated website — keeps it fresh across fill runs.
                    # needs_li_verify still gates whether Step 4 fires at all for complete records.
                    if li_website:
                        update_data["linkedin_website"] = li_website
                    elif needs_li_verify:
                        update_data["linkedin_website"] = ""  # sentinel: scraped, nothing listed
                    if li_website and not website_data:
                        ws2 = fetch_website_content(li_website, fast=False)
                        if ws2:
                            if needs_site and not update_data.get("website"):
                                # For ambiguous company names (single short generic word) an
                                # incorrect LinkedIn match could list its own site, which
                                # would be wrong for us. Validate the content first.
                                # For distinctive names this is guaranteed correct so skip.
                                if _name_is_distinctive(company_name) or _website_matches_company(company_name, ws2):
                                    update_data["website"] = li_website
                            if needs_type and not update_data.get("company_type"):
                                ct2, _ = classify_company_type_rules(ws2)
                                if ct2: update_data["company_type"] = ct2
                            if needs_desc and not update_data.get("description"):
                                desc2 = (ws2.get("meta_description") or
                                         ws2.get("first_para") or
                                         (ws2.get("hero", "")[:300].strip() or None))
                                if desc2: update_data["description"] = desc2
                            if needs_hq and not update_data.get("headquarters"):
                                loc2 = ws2.get("location")
                                if loc2: update_data["headquarters"] = loc2
                            if not company.get("compliance") and not update_data.get("compliance"):
                                comp2 = ws2.get("compliance_detected") or []
                                if comp2: update_data["compliance"] = ", ".join(comp2)
                except Exception:
                    pass

            # Groq inference — fills industry/founded/specialties if still blank after LI scrape
            _groq_key_bulk = os.environ.get("GROQ_API_KEY", "")
            _desc_bulk = update_data.get("description") or company.get("description") or ""
            _missing_bulk = (not update_data.get("industry") and not company.get("industry")) or \
                            (not update_data.get("founded") and not company.get("founded")) or \
                            (not update_data.get("specialties") and not company.get("specialties"))
            if _groq_key_bulk and _desc_bulk and _missing_bulk:
                try:
                    import json as _json_bulk
                    _bp = (
                        f'Company: {company_name}\nDescription: {_desc_bulk[:400]}\n\n'
                        'Extract these fields. Be specific and concise.\n'
                        '- industry: industry name (e.g. "Software Development", "Financial Services")\n'
                        '- founded: 4-digit founding year only (omit if unsure)\n'
                        '- specialties: 3-5 comma-separated specialty areas\n\n'
                        'Respond ONLY as JSON: {"industry":"...","founded":"...","specialties":"..."}\n'
                        'Use null for fields you are not confident about.'
                    )
                    _gr = requests.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {_groq_key_bulk}", "Content-Type": "application/json"},
                        json={"model": "llama-3.1-8b-instant",
                              "messages": [{"role": "user", "content": _bp}],
                              "max_tokens": 120, "temperature": 0.1},
                        timeout=10,
                    )
                    if _gr.status_code == 200:
                        _rb = _gr.json()["choices"][0]["message"]["content"].strip()
                        _mb = _re_mod.search(r'\{[^}]+\}', _rb, _re_mod.DOTALL)
                        if _mb:
                            _xb = _json_bulk.loads(_mb.group(0))
                            if not update_data.get("industry") and not company.get("industry") and \
                               _xb.get("industry") and _xb["industry"] not in (None, "null"):
                                update_data["industry"] = str(_xb["industry"])
                            if not update_data.get("founded") and not company.get("founded") and \
                               _xb.get("founded") and str(_xb["founded"]) not in ("", "None", "null"):
                                _yr_b = str(_xb["founded"]).strip()
                                if _re_mod.match(r'^\d{4}$', _yr_b) and 1800 <= int(_yr_b) <= 2030 and _yr_b in _desc_bulk:
                                    update_data["founded"] = _yr_b
                            if not update_data.get("specialties") and not company.get("specialties") and \
                               _xb.get("specialties") and _xb["specialties"] not in (None, "null"):
                                update_data["specialties"] = str(_xb["specialties"])
                except Exception:
                    pass

            # ── Step 5: DDGS snippet — employee count, followers, HQ ──────────
            # Runs regardless of whether li_url was found:
            #   • With slug: targets the exact company page (most precise)
            #   • Without slug: name-only query still surfaces LinkedIn cards
            #     from search engine knowledge panels with employee/follower data
            _needs_size_still      = needs_size      and not update_data.get("size")
            _needs_followers_still = needs_followers  and not update_data.get("followers")
            _needs_hq_still        = needs_hq         and not update_data.get("headquarters")
            if _needs_size_still or _needs_followers_still or _needs_hq_still:
                _m = _re_mod.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', li_url) if li_url else None
                li_slug = _m.group(1) if _m else ""
                snippet = _ddgs_run(_ddgs_linkedin_snippet, company_name, li_slug, timeout=20)
                if snippet:
                    if snippet.get("followers") and _needs_followers_still:
                        update_data["followers"] = snippet["followers"]
                    if snippet.get("employee_count") and _needs_size_still:
                        update_data["size"] = str(snippet["employee_count"])
                    if snippet.get("headquarters") and _needs_hq_still:
                        update_data["headquarters"] = snippet["headquarters"]

            # ── Step 6: DDGS general company info — description / HQ last resort ─
            # When website + LinkedIn both failed, a plain company name search often
            # returns snippets from Tracxn / Clutch / LinkedIn with useful metadata.
            _needs_desc_still = needs_desc and not update_data.get("description")
            _needs_hq_still2  = needs_hq   and not update_data.get("headquarters")
            if _needs_desc_still or _needs_hq_still2:
                _ddgs_run(_ddgs_general_info, company_name, update_data, _needs_desc_still, _needs_hq_still2, timeout=20)

            # ── Step 7: mine description text for still-missing size / HQ ──────
            # Directory snippets (Tracxn, Clutch, AmbitionBox) embed employee count
            # and location inside the description we already fetched — e.g.
            # "has 5000 & Above employees" or "based in Kerala". Extract them here
            # instead of making another DDGS call.
            desc_text = update_data.get("description") or company.get("description") or ""
            if desc_text:
                if needs_size and not update_data.get("size"):
                    m = _re_mod.search(
                        r'(\d[\d,]*(?:-[\d,]+)?(?:\+)?)'
                        r'(?:\s*[&+]\s*(?:above|more|plus|and above))?\s*employees?',
                        desc_text, _re_mod.I,
                    )
                    if m:
                        update_data["size"] = m.group(1).replace(",", "")
                if needs_hq and not update_data.get("headquarters"):
                    m = _re_mod.search(
                        r'(?:based in|headquartered? in|located in|offices? in)'
                        r'\s*([A-Z][a-zA-Z\s]{3,40}?)(?:[,.]|\s+and\s|\s+with\s|$)',
                        desc_text, _re_mod.I,
                    )
                    if m:
                        update_data["headquarters"] = m.group(1).strip()

            if update_data:
                supabase.table("companies").update(update_data).eq("id", company["id"]).eq("user_id", user_id).execute()

            return {"id": company["id"], "name": company_name, "success": True,
                    "filled": list(update_data.keys()), "update": update_data}

        except Exception as e:
            return {"id": company["id"], "name": company_name, "success": False,
                    "filled": [], "update": {}, "message": str(e)}

    import asyncio as _asyncio
    import queue as _queue
    import json as _json
    from fastapi.responses import StreamingResponse

    total = len(companies)
    result_queue = _queue.Queue()

    def _run_pool():
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(_autofill_one, c): c for c in companies}
            for future in as_completed(futures):
                try:
                    result_queue.put(future.result())
                except Exception as e:
                    result_queue.put({"success": False, "filled": [], "update": {}, "message": str(e)})
        result_queue.put(None)  # sentinel — pool is done

    pool_thread = _threading.Thread(target=_run_pool, daemon=True)
    pool_thread.start()

    async def event_stream():
        completed = 0
        filled_count = 0
        loop = _asyncio.get_running_loop()
        while True:
            result = await loop.run_in_executor(None, result_queue.get)
            if result is None:
                break
            completed += 1
            if result.get("filled"):
                filled_count += 1
            result["_progress"] = {"completed": completed, "total": total}
            yield _json.dumps(result) + "\n"
        posthog.capture(user_id, "companies_bulk_autofilled", {"total": total, "filled": filled_count})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# ─── BULK ANALYZE ─────────────────────────────────────────────

@router.post("/companies/bulk-analyze")
async def bulk_analyze_companies(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Analyze websites for multiple companies in parallel — fills company_type, compliance, description."""
    import time as _time
    import threading as _threading
    import queue as _queue
    import json as _json
    import asyncio as _asyncio
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from fastapi.responses import StreamingResponse

    user_id = get_user_id(authorization)
    _check_user_rate_limit(user_id, "bulk-analyze", limit=5, window_minutes=60)
    company_ids = payload.get("company_ids", [])
    gemini_key      = payload.get("gemini_key")      or os.getenv("GEMINI_API_KEY", "")
    openai_key      = payload.get("openai_key")      or os.getenv("OPENAI_API_KEY", "")
    groq_key        = payload.get("groq_key")        or os.getenv("GROQ_API_KEY", "")
    openrouter_key  = payload.get("openrouter_key")  or os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model = payload.get("openrouter_model") or ""

    from .website_analyzer import (fetch_website_content, classify_company_type_rules,
                                    analyze_with_gemini, analyze_with_openai, analyze_with_groq,
                                    analyze_with_openrouter)

    try:
        if company_ids:
            co_res = supabase.table("companies").select("*").in_("id", company_ids).eq("user_id", user_id).execute()
        else:
            co_res = supabase.table("companies").select("*").eq("user_id", user_id).execute()
        companies = [c for c in (co_res.data or []) if c.get("website")]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    def _analyze_one(company: dict) -> dict:
        name = company.get("name", "")
        cid  = company["id"]
        try:
            website = company.get("website", "")
            if not website:
                return {"id": cid, "name": name, "success": False, "filled": [], "update": {}, "message": "No website"}

            website_data = fetch_website_content(website)
            if not website_data:
                return {"id": cid, "name": name, "success": False, "filled": [], "update": {}, "message": "Website unreachable"}

            # Rules-based classification (fast, no AI cost)
            rule_type, rule_confidence = classify_company_type_rules(website_data, company.get("description", ""))

            # AI fallback when rules aren't High-confidence
            # Chain: Gemini → OpenRouter → OpenAI → Groq
            ai_result = {}
            if rule_confidence != "High":
                if gemini_key:
                    ai_result = analyze_with_gemini(website_data, name, gemini_key) or {}
                if not ai_result and openrouter_key:
                    kw = {"model": openrouter_model} if openrouter_model else {}
                    ai_result = analyze_with_openrouter(website_data, name, openrouter_key, **kw) or {}
                if not ai_result and openai_key:
                    r = analyze_with_openai(website_data, name, openai_key)
                    if not r.get("_openai_error"):
                        ai_result = r
                if not ai_result and groq_key:
                    ai_result = analyze_with_groq(website_data, name,
                                                  company.get("industry", ""),
                                                  company.get("description", ""), groq_key) or {}

            # Determine final company_type (rules win at High/Medium)
            ai_type = ai_result.get("company_type", "")
            if ai_type == "Services": ai_type = "Service"
            final_type = rule_type if rule_confidence in ("High", "Medium") and rule_type else (ai_type or rule_type)

            # Merge compliance
            scraped_compliance = website_data.get("compliance_detected") or []
            ai_compliance      = ai_result.get("compliance") or []
            merged_compliance  = list(dict.fromkeys(scraped_compliance + ai_compliance))

            VALID_CLASSIFICATIONS = {
                'Fintech', 'Healthtech', 'SaaS', 'Cybersecurity', 'IT Services',
                'E-commerce', 'Edtech', 'Logistics', 'Manufacturing', 'Banking',
                'Insurance', 'VC / Investment', 'Media', 'Consulting', 'Retail',
                'Real Estate', 'Government', 'Non-profit', 'Other',
            }

            update_data = {}
            if final_type and not company.get("company_type"):
                update_data["company_type"] = final_type
            if merged_compliance and not company.get("compliance"):
                update_data["compliance"] = ", ".join(merged_compliance)

            ws_description = (
                ai_result.get("website_summary")
                or website_data.get("meta_description")
                or website_data.get("first_para")
                or (website_data.get("hero", "")[:300].strip() or None)
            )
            if ws_description and not company.get("description"):
                update_data["description"] = ws_description

            ws_location = website_data.get("location")
            if ws_location and not company.get("headquarters"):
                update_data["headquarters"] = ws_location

            ai_class = ai_result.get("classification", "").strip()
            current_cls = company.get("classification") or ""
            if ai_class in VALID_CLASSIFICATIONS and (not current_cls or current_cls == "Unclassified"):
                update_data["classification"] = ai_class

            if update_data:
                supabase.table("companies").update(update_data).eq("id", cid).eq("user_id", user_id).execute()

            return {"id": cid, "name": name, "success": True, "filled": list(update_data.keys()), "update": update_data}

        except Exception as e:
            return {"id": cid, "name": name, "success": False, "filled": [], "update": {}, "message": str(e)}

    total = len(companies)
    result_queue = _queue.Queue()

    def _run_pool():
        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = {executor.submit(_analyze_one, c): c for c in companies}
            for future in as_completed(futures):
                try:
                    result_queue.put(future.result())
                except Exception as e:
                    result_queue.put({"success": False, "filled": [], "update": {}, "message": str(e)})
        result_queue.put(None)

    pool_thread = _threading.Thread(target=_run_pool, daemon=True)
    pool_thread.start()

    async def event_stream():
        completed = 0
        filled_count = 0
        loop = _asyncio.get_running_loop()
        while True:
            result = await loop.run_in_executor(None, result_queue.get)
            if result is None:
                break
            completed += 1
            if result.get("filled"):
                filled_count += 1
            result["_progress"] = {"completed": completed, "total": total}
            yield _json.dumps(result) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# ─── BULK MAPS ENRICH ─────────────────────────────────────────

@router.post("/companies/bulk-maps-enrich")
async def bulk_maps_enrich(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Enrich companies with Google Maps Places API — fills HQ address, website, phone."""
    import threading as _threading
    import queue as _queue
    import json as _json
    import asyncio as _asyncio
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from fastapi.responses import StreamingResponse

    user_id  = get_user_id(authorization)
    company_ids = payload.get("company_ids", [])
    maps_key    = payload.get("maps_key") or os.getenv("GOOGLE_MAPS_API_KEY", "")

    if not maps_key:
        raise HTTPException(status_code=400, detail="Google Maps API key required. Add it in Settings → Maps.")

    try:
        if company_ids:
            co_res = supabase.table("companies").select("*").in_("id", company_ids).eq("user_id", user_id).execute()
        else:
            co_res = supabase.table("companies").select("*").eq("user_id", user_id).execute()
        companies = co_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    def _clean_name(name: str) -> str:
        """Strip Indian legal suffixes so Maps can match the trade name."""
        import re as _re
        # Remove common suffixes in order (longest first)
        suffixes = [
            r'\s*\(P\)\s*Pvt\.?\s*Ltd\.?',
            r'\s*\(P\)\s*Ltd\.?',
            r'\s*Private\s+Limited',
            r'\s*Pvt\.?\s*Ltd\.?',
            r'\s*\bLLP\b',
            r'\s*\bLLC\b',
            r'\s*\bInc\.?',
            r'\s*\bLtd\.?',
            r'\s*\bLimited',
            r'\s*\bPvt\.?',
            r'\s*\bCorp\.?',
        ]
        # Use primary name only when there's a slash alias (e.g. "X LLP / ALIAS" → "X LLP")
        cleaned = name.split(' / ')[0].strip()
        for pat in suffixes:
            cleaned = _re.sub(pat + r'\s*$', '', cleaned, flags=_re.IGNORECASE).strip()
        return cleaned or name

    def _maps_search(company_name: str, bias_lat: float = 8.5241, bias_lng: float = 76.9366) -> tuple:
        """Call Google Places API (New) text search. Returns (place_dict, error_str)."""
        search_name = _clean_name(company_name)
        try:
            resp = requests.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": maps_key,
                    "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount",
                },
                json={
                    "textQuery": search_name,
                    "maxResultCount": 1,
                    "locationBias": {
                        "circle": {
                            "center": {"latitude": bias_lat, "longitude": bias_lng},
                            "radius": 80000.0,
                        }
                    },
                },
                timeout=8,
            )
            data = resp.json()
            if "error" in data:
                err = data["error"]
                return {}, f"Maps API error {err.get('code', '?')}: {err.get('message', str(err))}"
            places = data.get("places", [])
            return (places[0] if places else {}), None
        except Exception as e:
            return {}, str(e)

    def _enrich_one(company: dict) -> dict:
        cid  = company["id"]
        name = company.get("name", "")
        try:
            place, err = _maps_search(name)
            if err:
                return {"id": cid, "name": name, "success": False,
                        "filled": [], "update": {}, "message": err}
            if not place:
                return {"id": cid, "name": name, "success": False,
                        "filled": [], "update": {}, "message": "not found on Maps"}

            update_data = {}

            # Maps address is authoritative — always overwrite
            address = place.get("formattedAddress", "")
            if address:
                update_data["headquarters"] = address

            # Only fill website if missing
            website = place.get("websiteUri", "").rstrip("/")
            if website and not company.get("website"):
                update_data["website"] = website

            # Save phone to dedicated field
            phone = place.get("nationalPhoneNumber", "") or place.get("internationalPhoneNumber", "")
            if phone and not company.get("phone"):
                update_data["phone"] = phone

            rating = place.get("rating")
            rating_count = place.get("userRatingCount")
            if rating and not company.get("revenue"):
                update_data["revenue"] = f"⭐ {rating} ({rating_count} reviews)"

            if update_data:
                supabase.table("companies").update(update_data).eq("id", cid).eq("user_id", user_id).execute()

            return {"id": cid, "name": name, "success": True,
                    "filled": list(update_data.keys()), "update": update_data,
                    "maps_address": address}

        except Exception as e:
            return {"id": cid, "name": name, "success": False,
                    "filled": [], "update": {}, "message": str(e)}

    total = len(companies)
    result_queue = _queue.Queue()

    def _run_pool():
        # 10 workers — Maps API allows ~10 QPS on free tier
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(_enrich_one, c): c for c in companies}
            for future in as_completed(futures):
                try:
                    result_queue.put(future.result())
                except Exception as e:
                    result_queue.put({"success": False, "filled": [], "update": {}, "message": str(e)})
        result_queue.put(None)

    pool_thread = _threading.Thread(target=_run_pool, daemon=True)
    pool_thread.start()

    async def event_stream():
        completed = 0
        filled_count = 0
        loop = _asyncio.get_running_loop()
        while True:
            result = await loop.run_in_executor(None, result_queue.get)
            if result is None:
                break
            completed += 1
            if result.get("filled"):
                filled_count += 1
            result["_progress"] = {"completed": completed, "total": total}
            yield _json.dumps(result) + "\n"
        posthog.capture(user_id, "companies_bulk_maps_enriched", {"total": total, "filled": filled_count})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# ─── MAPS DISCOVER ────────────────────────────────────────────

@router.post("/companies/maps-discover")
async def maps_discover(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Search Google Maps for companies by industry + location. Returns up to 20 prospects."""
    get_user_id(authorization)
    maps_key = payload.get("maps_key") or os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not maps_key:
        raise HTTPException(status_code=400, detail="Google Maps API key required.")

    query     = payload.get("query", "")          # e.g. "SaaS companies"
    location  = payload.get("location", "")        # e.g. "Bangalore, India"
    lat       = payload.get("lat")
    lng       = payload.get("lng")
    radius_km = float(payload.get("radius_km", 50))
    max_res   = min(int(payload.get("max_results", 20)), 20)

    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    text_query = f"{query} {location}".strip()

    body: dict = {
        "textQuery": text_query,
        "maxResultCount": max_res,
    }
    if lat and lng:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": float(lat), "longitude": float(lng)},
                "radius": radius_km * 1000,
            }
        }

    try:
        resp = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": maps_key,
                "X-Goog-FieldMask": (
                    "places.displayName,places.formattedAddress,"
                    "places.websiteUri,places.nationalPhoneNumber,"
                    "places.rating,places.userRatingCount,places.types,"
                    "places.location"
                ),
            },
            json=body,
            timeout=10,
        )
        data = resp.json()
        if "error" in data:
            err = data["error"]
            raise HTTPException(status_code=502, detail=f"Maps API: {err.get('message', str(err))}")

        places = data.get("places", [])
        results = []
        for p in places:
            name    = (p.get("displayName") or {}).get("text", "")
            website = p.get("websiteUri", "").rstrip("/")
            domain = ""
            if website:
                from urllib.parse import urlparse as _up
                domain = _up(website).netloc.replace("www.", "")
            loc = p.get("location") or {}
            results.append({
                "name":         name,
                "address":      p.get("formattedAddress", ""),
                "website":      website,
                "domain":       domain,
                "phone":        p.get("nationalPhoneNumber", ""),
                "rating":       p.get("rating"),
                "rating_count": p.get("userRatingCount"),
                "types":        p.get("types", []),
                "lat":          loc.get("latitude"),
                "lng":          loc.get("longitude"),
            })

        return {"results": results, "total": len(results), "query": text_query}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── BULK IMPORT FROM EXTENSION ──────────────────────────────

@router.post("/leads/bulk")
async def bulk_create_leads(
    payload: dict,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    leads = payload.get("leads", [])
    if not leads:
        raise HTTPException(status_code=400, detail="No leads provided")

    inserted = []
    skipped = 0

    for lead in leads:
        try:
            lead["user_id"] = user_id

            # Clean up profile_url
            profile_url = lead.get("profile_url")
            if profile_url:
                profile_url = profile_url.strip()
                lead["profile_url"] = profile_url

            # Skip if no name
            if not lead.get("name") or not lead["name"].strip():
                skipped += 1
                continue

            # Dedup by profile_url (most reliable — covers LinkedIn scrapes)
            if profile_url and len(profile_url) > 10:
                existing = supabase.table("leads")\
                    .select("id")\
                    .eq("user_id", user_id)\
                    .eq("profile_url", profile_url)\
                    .execute()
                if existing.data:
                    skipped += 1
                    continue

            # Dedup by name + company for leads without a profile URL
            # (prevents the same person being imported twice from different sources)
            elif not profile_url:
                lead_name  = (lead.get("name") or "").strip().lower()
                lead_co    = (lead.get("company") or "").strip().lower()
                if lead_name and lead_co:
                    existing = supabase.table("leads")\
                        .select("id")\
                        .eq("user_id", user_id)\
                        .ilike("name", lead_name)\
                        .ilike("company", lead_co)\
                        .execute()
                    if existing.data:
                        skipped += 1
                        continue

            # Clean the data
            # Auto split name into first and last
            name = lead.get("name", "").strip()
            name_parts = name.split(" ", 1)
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            followers_raw = lead.get("followers_count", "") or lead.get("followers", "") or ""
            followers_clean = followers_raw.replace("followers", "").replace("follower", "").strip() if followers_raw else None

            employee_raw = lead.get("employee_count", "") or lead.get("employeeCount", "") or ""
            employee_clean = employee_raw.strip() if employee_raw else None

            clean_lead = {
                "user_id": user_id,
                "name": name,
                "first_name": first_name,
                "last_name": last_name,
                "title": lead.get("title", "").strip() if lead.get("title") else None,
                "company": lead.get("company", "").strip() if lead.get("company") else None,
                "location": lead.get("location", "").strip() if lead.get("location") else None,
                "email": lead.get("email") or None,
                "phone": lead.get("phone") or None,
                "profile_url": profile_url or None,
                "status": lead.get("status", "new"),
                "notes": lead.get("notes") or None,
                "scraped_at": lead.get("scraped_at") or lead.get("scrapedAt") or None,
                "followers_count": followers_clean or None,
                "employee_count": employee_clean or None,
                "website": lead.get("website") or None,
                "appointment": lead.get("appointment") or None,
            }

            response = supabase.table("leads").insert(clean_lead).execute()
            inserted.append(response.data[0])

        except Exception as e:
            err = str(e)
            # DB unique constraint violation = duplicate; treat as skipped not error
            if "duplicate" in err.lower() or "unique" in err.lower() or "23505" in err:
                skipped += 1
            else:
                print(f"Lead insert error: {e}")
                skipped += 1
            continue

    posthog.capture(user_id, "leads_bulk_imported", {
        "inserted": len(inserted),
        "skipped": skipped,
        "total": len(leads),
    })
    return {
        "inserted": len(inserted),
        "skipped": skipped,
        "leads": inserted
    }

@router.post("/leads/debug-bulk")
async def debug_bulk(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    leads = payload.get("leads", [])
    results = []
    for lead in leads[:3]:  # Only check first 3
        profile_url = lead.get("profile_url", "").strip() if lead.get("profile_url") else None
        existing = []
        if profile_url and len(profile_url) > 10:
            res = supabase.table("leads").select("id").eq("user_id", user_id).eq("profile_url", profile_url).execute()
            existing = res.data
        results.append({
            "name": lead.get("name"),
            "profile_url": profile_url,
            "existing_count": len(existing),
            "would_skip": len(existing) > 0
        })
    total_in_db = supabase.table("leads").select("id").eq("user_id", user_id).execute()
    return {"leads_in_db": len(total_in_db.data), "check_results": results, "payload_count": len(leads)}# ─── SPREADSHEET AUTO-FILL ────────────────────────────────────

@router.post("/leads/{lead_id}/autofill")
async def autofill_lead(
    lead_id: str,
    payload: dict,
    authorization: str = Header(...)
):
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)

    try:
        from groq import Groq
        import json

        # Get lead details
        lead_res = supabase.table("leads")\
            .select("*")\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()

        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")

        lead = lead_res.data[0]
        company_name = lead.get("company", "")
        groq_api_key = payload.get("groq_api_key", "")

        if not groq_api_key:
            raise HTTPException(status_code=400, detail="Groq API key required")

        # Check if company has security leads
        security_keywords = ["ciso", "security", "cybersecurity", "infosec", "grc",
                           "penetration", "vulnerability", "soc analyst", "devsecops"]
        company_leads = supabase.table("leads")\
            .select("title")\
            .eq("user_id", user_id)\
            .ilike("company", company_name)\
            .execute()

        has_security_team = "No"
        if company_leads.data:
            for cl in company_leads.data:
                title = (cl.get("title") or "").lower()
                if any(kw in title for kw in security_keywords):
                    has_security_team = "Yes"
                    break

        # Derive org size from employee count
        employee_count = lead.get("employee_count", "") or ""
        org_size = ""
        if employee_count:
            nums = [int(n) for n in __import__('re').findall(r'\d+', employee_count)]
            if nums:
                n = nums[0]
                if n <= 10: org_size = "1-10"
                elif n <= 50: org_size = "11-50"
                elif n <= 200: org_size = "51-200"
                elif n <= 500: org_size = "201-500"
                elif n <= 1000: org_size = "501-1000"
                else: org_size = "1000+"

        update_data = {}

        # Auto-fill from existing scraped data
        if lead.get("followers_count") and not lead.get("followers_count") == "":
            update_data["followers_count"] = lead["followers_count"]
        if employee_count:
            update_data["employee_count"] = employee_count
        if org_size:
            update_data["org_size"] = org_size
        if has_security_team:
            update_data["has_security_team"] = has_security_team

        # Use Groq to fetch website and estimate revenue
        if company_name and groq_api_key:
            client = Groq(api_key=groq_api_key)

            prompt = f"""For the company "{company_name}", provide:
1. Their official website URL (just the domain, e.g. company.com)
2. Estimated annual revenue in USD millions (just a number or range)

Respond in JSON only:
{{
  "website": "company.com or empty string if unknown",
  "revenue": "estimated revenue in USD millions or empty string if unknown"
}}"""

            try:
                completion = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=150,
                )
                response_text = completion.choices[0].message.content.strip()
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0].strip()
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0].strip()

                ai_data = json.loads(response_text)
                if ai_data.get("website") and not lead.get("website"):
                    update_data["website"] = "https://" + ai_data["website"].replace("https://", "").replace("http://", "")
                if ai_data.get("revenue") and not lead.get("revenue"):
                    update_data["revenue"] = ai_data["revenue"]
            except Exception as e:
                print(f"Groq autofill error: {e}")

        # Update lead in database
        if update_data:
            supabase.table("leads")\
                .update(update_data)\
                .eq("id", lead_id)\
                .eq("user_id", user_id)\
                .execute()

        return {
            "lead_id": lead_id,
            "updated_fields": list(update_data.keys()),
            "data": update_data
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"AUTOFILL ERROR: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))




# ─── AI FEATURES ─────────────────────────────────────────────────────────────

def _call_ai(prompt: str, max_tokens: int = 300, user_id: str = None, feature: str = None) -> str:
    """Call Groq → Gemini in order, return raw text or raise. Emits $ai_generation to PostHog."""
    import json as _json, time as _time, uuid as _uuid
    groq_key   = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    content = ""
    trace_id = str(_uuid.uuid4())
    if groq_key:
        t0 = _time.monotonic()
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}],
                  "max_tokens": max_tokens, "temperature": 0.2},
            timeout=20,
        )
        latency = _time.monotonic() - t0
        d = r.json()
        if "choices" in d:
            content = d["choices"][0]["message"]["content"].strip()
            usage = d.get("usage", {})
            if user_id:
                posthog.capture(user_id, "$ai_generation", {
                    "$ai_provider": "groq",
                    "$ai_model": "llama-3.3-70b-versatile",
                    "$ai_input_tokens": usage.get("prompt_tokens"),
                    "$ai_output_tokens": usage.get("completion_tokens"),
                    "$ai_latency": round(latency, 3),
                    "$ai_http_status": r.status_code,
                    "$ai_trace_id": trace_id,
                    "feature": feature,
                })
    if not content and gemini_key:
        t0 = _time.monotonic()
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
            headers={"Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_tokens}},
            timeout=20,
        )
        latency = _time.monotonic() - t0
        d = r.json()
        if "candidates" in d:
            content = d["candidates"][0]["content"]["parts"][0]["text"].strip()
            usage = d.get("usageMetadata", {})
            if user_id:
                posthog.capture(user_id, "$ai_generation", {
                    "$ai_provider": "gemini",
                    "$ai_model": "gemini-2.0-flash",
                    "$ai_input_tokens": usage.get("promptTokenCount"),
                    "$ai_output_tokens": usage.get("candidatesTokenCount"),
                    "$ai_latency": round(latency, 3),
                    "$ai_http_status": r.status_code,
                    "$ai_trace_id": trace_id,
                    "feature": feature,
                })
    if not content:
        raise HTTPException(status_code=503, detail="No AI key configured. Add GROQ_API_KEY or GEMINI_API_KEY in Settings.")
    return content


@router.post("/leads/{lead_id}/score-icp")
async def score_lead_icp(lead_id: str, authorization: str = Header(...)):
    """Score a lead 0–100 against the user's ICP profiles using AI."""
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        lead_res = supabase.table("leads").select("*").eq("id", lead_id).eq("user_id", user_id).execute()
        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = lead_res.data[0]

        icp_res = supabase.table("icp_profiles").select("*").eq("user_id", user_id).limit(10).execute()
        icps = icp_res.data or []

        # Aggregate ICP criteria
        target_roles = list({r for p in icps for r in (p.get("target_roles") or [])})
        pain_points  = list({pp for p in icps for pp in (p.get("pain_points") or [])})
        tech_stack   = list({t for p in icps for t in (p.get("tech_stack") or [])})
        industries   = list({p.get("industry") for p in icps if p.get("industry")})
        sizes        = list({p.get("company_size") for p in icps if p.get("company_size")})

        criteria_lines = []
        if target_roles:  criteria_lines.append(f"Target roles: {', '.join(target_roles)}")
        if industries:    criteria_lines.append(f"Target industries: {', '.join(industries)}")
        if sizes:         criteria_lines.append(f"Target company sizes: {', '.join(sizes)}")
        if pain_points:   criteria_lines.append(f"Pain points we solve: {', '.join(pain_points)}")
        if tech_stack:    criteria_lines.append(f"Relevant tech stack: {', '.join(tech_stack)}")

        if not criteria_lines:
            criteria_lines = ["No specific ICP defined — score based on general B2B sales-readiness signals."]

        exp_summary = ""
        if lead.get("experience"):
            titles = [e.get("title", "") for e in (lead["experience"] or [])[:3] if e.get("title")]
            if titles:
                exp_summary = f"\nPast roles: {', '.join(titles)}"

        prompt = f"""You are a B2B sales qualification expert. Score this lead against the Ideal Customer Profile (ICP).

ICP CRITERIA:
{chr(10).join(criteria_lines)}

LEAD:
Name: {lead.get('name', '—')}
Title: {lead.get('title', '—')}
Company: {lead.get('company', '—')}
Location: {lead.get('location', '—')}
About: {(lead.get('about') or '')[:300]}{exp_summary}

Score from 0–100 based on how well this lead matches the ICP. Be precise and honest.
- 80–100: Strong fit — matches role, industry, and likely has pain points
- 50–79: Moderate fit — partial match
- 0–49: Weak fit — unlikely match

Reply ONLY with valid JSON (no markdown):
{{"score": <integer 0-100>, "reason": "<one concise sentence explaining the score>"}}"""

        import re as _re, json as _json
        raw = _call_ai(prompt, max_tokens=120, user_id=user_id, feature="icp-scoring")
        raw = _re.sub(r'^```json\s*|^```\s*|\s*```$', '', raw.strip(), flags=_re.MULTILINE).strip()
        result = _json.loads(raw)
        score  = max(0, min(100, int(result["score"])))
        reason = result.get("reason", "")

        supabase.table("leads").update({"icp_score": score, "icp_score_reason": reason})\
            .eq("id", lead_id).eq("user_id", user_id).execute()

        posthog.capture(user_id, "lead_icp_scored", {"score": score})
        return {"score": score, "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/{lead_id}/draft-email")
async def draft_outreach_email(
    lead_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    """Generate a personalized cold outreach email for a lead."""
    validate_uuid(lead_id, "lead_id")
    user_id = get_user_id(authorization)
    try:
        lead_res = supabase.table("leads").select("*").eq("id", lead_id).eq("user_id", user_id).execute()
        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = lead_res.data[0]

        # Fetch linked company for extra context
        company_ctx = ""
        if lead.get("company"):
            co_res = supabase.table("companies").select(
                "description,industry,classification,compliance,specialties,tagline"
            ).eq("user_id", user_id).ilike("name", lead["company"]).limit(1).execute()
            if co_res.data:
                c = co_res.data[0]
                parts = []
                if c.get("industry"):       parts.append(f"Industry: {c['industry']}")
                if c.get("classification"): parts.append(f"Type: {c['classification']}")
                if c.get("description"):    parts.append(f"About: {c['description'][:200]}")
                if c.get("compliance"):     parts.append(f"Compliance: {c['compliance']}")
                company_ctx = "\n".join(parts)

        tone = payload.get("tone", "professional")
        sender_name = payload.get("sender_name", "")
        sender_role = payload.get("sender_role", "")
        value_prop  = payload.get("value_prop", "")

        sender_block = ""
        if sender_name: sender_block += f"Sender name: {sender_name}\n"
        if sender_role: sender_block += f"Sender role: {sender_role}\n"
        if value_prop:  sender_block += f"Value proposition: {value_prop}\n"

        exp_summary = ""
        if lead.get("experience"):
            recent = lead["experience"][:2] if lead["experience"] else []
            bits = [f"{e.get('title','')} at {e.get('company','')}" for e in recent if e.get("title")]
            if bits: exp_summary = f"\nRecent experience: {', '.join(bits)}"

        prompt = f"""Write a personalized B2B cold outreach email. Be {tone}, concise (under 120 words body), and specific to this person. Do NOT use generic openers like "I hope this email finds you well."

LEAD:
Name: {lead.get('name', 'there')}
Title: {lead.get('title', '—')}
Company: {lead.get('company', '—')}
Location: {lead.get('location', '')}
About: {(lead.get('about') or '')[:200]}{exp_summary}

COMPANY CONTEXT:
{company_ctx or 'No additional company data available.'}

{sender_block}

Reply ONLY with valid JSON (no markdown):
{{"subject": "<email subject line>", "body": "<email body with \\n for line breaks>"}}"""

        import re as _re, json as _json
        raw = _call_ai(prompt, max_tokens=400, user_id=user_id, feature="email-draft")
        raw = _re.sub(r'^```json\s*|^```\s*|\s*```$', '', raw.strip(), flags=_re.MULTILINE).strip()
        result  = _json.loads(raw)
        subject = result.get("subject", "")
        body    = result.get("body", "")

        supabase.table("leads").update({"email_draft": body, "email_draft_subject": subject})\
            .eq("id", lead_id).eq("user_id", user_id).execute()

        posthog.capture(user_id, "lead_email_drafted")
        return {"subject": subject, "body": body}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/{lead_id}/ai-icebreaker")
async def generate_ai_icebreaker(lead_id: str, authorization: str = Header(...)):
    """Generate a personalized one-line opener for a cold email — specific to this lead's role & company."""
    validate_uuid(lead_id)
    user_id = get_user_id(authorization)
    try:
        lead_res = supabase.table("leads").select("name,title,company,location,about,experience").eq("id", lead_id).eq("user_id", user_id).limit(1).execute()
        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = lead_res.data[0]

        exp_line = ""
        if lead.get("experience"):
            recent = (lead["experience"] or [])[:1]
            if recent and recent[0].get("title"):
                exp_line = f"\nPrevious role: {recent[0].get('title','')} at {recent[0].get('company','')}"

        prompt = f"""Write ONE personalized opening sentence for a cold outreach email.

Rules:
- Specific to this person's role and company (reference their actual title or company work)
- Sound human and natural — NOT AI-generated
- Under 25 words
- Do NOT use hollow openers: "I hope", "I noticed", "I came across", "I saw that", "I wanted to reach out"
- No quotation marks in your reply

Person:
Name: {lead.get('name') or 'there'}
Title: {lead.get('title') or '—'}
Company: {lead.get('company') or '—'}
Location: {lead.get('location') or '—'}{exp_line}

Reply with ONLY the opening sentence."""

        icebreaker = _call_ai(prompt, max_tokens=60, user_id=user_id, feature="icebreaker")
        icebreaker = icebreaker.strip().strip('"').strip("'")
        return {"icebreaker": icebreaker}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leads/draft-cold")
async def draft_cold_email(payload: dict, authorization: str = Header(...)):
    """Draft a cold reply for a sender who is not yet in the pipeline (used by Gmail sidebar)."""
    user_id = get_user_id(authorization)
    import json as _json, re as _re
    name    = payload.get("name", "there")
    subject = payload.get("subject", "")
    prompt = f"""Write a short, professional reply email.

Context:
- Sender name: {name}
- Original subject: {subject}
- We're replying on behalf of a B2B sales professional
- Keep it friendly, concise (3-4 sentences), no fluff

Reply with JSON only: {{"subject": "<reply subject>", "body": "<email body>"}}"""
    try:
        raw = _call_ai(prompt, max_tokens=300, user_id=user_id, feature="cold-draft")
        raw = _re.sub(r'^```json\s*|^```\s*|\s*```$', '', raw.strip(), flags=_re.MULTILINE).strip()
        result = _json.loads(raw)
        return {"subject": result.get("subject", f"Re: {subject}"), "body": result.get("body", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/companies/{company_id}/enrich-pipeline")
async def enrich_pipeline(
    company_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    """Run website analysis → compliance check → maps enrich in one streaming call."""
    validate_uuid(company_id, "company_id")
    user_id = get_user_id(authorization)

    co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")

    from .website_analyzer import (
        fetch_website_content, analyze_with_gemini, analyze_with_groq,
        classify_with_groq, classify_company_type_rules,
    )
    import json as _json

    gemini_key     = os.getenv("GEMINI_API_KEY", "")
    groq_key       = os.getenv("GROQ_API_KEY", "")
    li_cookie      = payload.get("li_cookie") or os.getenv("LI_SESSION_COOKIE", "")

    async def _stream():
        company = co_res.data[0]
        update_patch = {}

        # ── Step 1: Website Analysis ─────────────────────────────
        yield _json.dumps({"step": "website", "status": "running", "label": "Analyzing website…"}) + "\n"
        try:
            website = company.get("website", "")
            if website:
                website_data = fetch_website_content(website)
                rule_type, rule_confidence = classify_company_type_rules(
                    website_data, company.get("description", "")
                )
                result = {}
                if rule_confidence != "High":
                    if website_data and gemini_key:
                        result = analyze_with_gemini(website_data, company.get("name", ""), gemini_key) or {}
                    if not result and groq_key:
                        result = analyze_with_groq(
                            website_data, company.get("name", ""),
                            company.get("industry", ""), company.get("description", ""), groq_key
                        ) or {}
                if not result and rule_type:
                    result = {"classification": rule_type}
                for field in ("classification", "industry", "description", "revenue", "employee_count", "tagline", "specialties"):
                    if result.get(field) and not company.get(field):
                        update_patch[field] = result[field]
                yield _json.dumps({"step": "website", "status": "done", "label": "Website analyzed", "data": result}) + "\n"
            else:
                yield _json.dumps({"step": "website", "status": "skipped", "label": "No website — skipped"}) + "\n"
        except Exception as e:
            yield _json.dumps({"step": "website", "status": "error", "label": f"Website error: {str(e)[:80]}"}) + "\n"

        # ── Step 2: Compliance Check ──────────────────────────────
        yield _json.dumps({"step": "compliance", "status": "running", "label": "Checking compliance…"}) + "\n"
        try:
            if not company.get("compliance"):
                website = company.get("website", "")
                compliance_found = []
                if website:
                    website_data = fetch_website_content(website)
                    if website_data:
                        compliance_found = website_data.get("compliance_detected", [])
                if (groq_key or gemini_key) and company.get("name"):
                    description = update_patch.get("description") or company.get("description", "")
                    industry    = update_patch.get("industry")    or company.get("industry", "")
                    comp_prompt = f"""Company: {company['name']}
Industry: {industry or 'Unknown'}
Description: {description or 'None'}
Compliance already detected: {compliance_found}

What compliance standards does this company likely have? Reply ONLY valid JSON:
{{"additional_compliance": [], "has_security_team": "Yes" or "No" or "Unknown"}}
Return empty array if not sure."""
                    try:
                        import re as _re
                        raw = _call_ai(comp_prompt, max_tokens=150, user_id=user_id, feature="enrichment-pipeline")
                        raw = _re.sub(r'^```json\s*|^```\s*|\s*```$', '', raw.strip(), flags=_re.MULTILINE).strip()
                        ai_comp = _json.loads(raw)
                        for item in ai_comp.get("additional_compliance", []):
                            if item and item not in compliance_found:
                                compliance_found.append(item)
                    except Exception:
                        pass
                if compliance_found:
                    update_patch["compliance"] = ", ".join(compliance_found)
                yield _json.dumps({"step": "compliance", "status": "done", "label": "Compliance checked", "data": {"compliance": compliance_found}}) + "\n"
            else:
                yield _json.dumps({"step": "compliance", "status": "skipped", "label": "Compliance already set"}) + "\n"
        except Exception as e:
            yield _json.dumps({"step": "compliance", "status": "error", "label": f"Compliance error: {str(e)[:80]}"}) + "\n"

        # ── Step 3: Maps Enrich ───────────────────────────────────
        yield _json.dumps({"step": "maps", "status": "running", "label": "Enriching from Google Maps…"}) + "\n"
        try:
            maps_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
            if maps_key and not company.get("phone") and company.get("name"):
                search_q = f"{company['name']} {company.get('headquarters', '')}"
                place_res = requests.get(
                    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                    params={"input": search_q, "inputtype": "textquery",
                            "fields": "name,formatted_phone_number,website,rating,user_ratings_total",
                            "key": maps_key},
                    timeout=10,
                ).json()
                candidates = place_res.get("candidates", [])
                if candidates:
                    p = candidates[0]
                    if p.get("formatted_phone_number") and not company.get("phone"):
                        update_patch["phone"] = p["formatted_phone_number"]
                    if p.get("website") and not company.get("website"):
                        update_patch["website"] = p["website"]
                yield _json.dumps({"step": "maps", "status": "done", "label": "Maps enriched", "data": {"phone": update_patch.get("phone")}}) + "\n"
            else:
                yield _json.dumps({"step": "maps", "status": "skipped", "label": "Maps skipped (no key or phone already set)"}) + "\n"
        except Exception as e:
            yield _json.dumps({"step": "maps", "status": "error", "label": f"Maps error: {str(e)[:80]}"}) + "\n"

        # ── Save all collected patches ────────────────────────────
        if update_patch:
            supabase.table("companies").update(update_patch)\
                .eq("id", company_id).eq("user_id", user_id).execute()

        posthog.capture(user_id, "company_pipeline_enriched", {"fields_updated": list(update_patch.keys())})
        yield _json.dumps({"step": "done", "status": "done", "label": "Pipeline complete", "fields_updated": list(update_patch.keys())}) + "\n"

    from fastapi.responses import StreamingResponse
    return StreamingResponse(_stream(), media_type="application/x-ndjson")


@router.get("/health")
def health_check():
    return {"status": "ok"}


# ─── ASYNC JOB API (SQS-backed) ──────────────────────────────────────────────

from .queue import dispatch_job, get_job


@router.get("/jobs")
async def list_jobs(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("jobs").select(
        "id,type,status,total,completed,errors,created_at,updated_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
    return res.data or []


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, authorization: str = Header(...)):
    validate_uuid(job_id, "job_id")
    user_id = get_user_id(authorization)
    job = get_job(job_id, user_id, supabase)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/companies/bulk-autofill/async")
async def bulk_autofill_companies_async(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Dispatch bulk company enrichment to SQS worker. Returns job_id to poll."""
    user_id = get_user_id(authorization)
    job_id = dispatch_job("bulk_enrichment", user_id, {
        "company_ids":    payload.get("company_ids", []),
        "openrouter_key": payload.get("openrouter_key", ""),
        "li_cookie":      payload.get("li_cookie", ""),
    }, supabase)
    return {"job_id": job_id, "status": "queued"}


@router.post("/companies/bulk-analyze/async")
async def bulk_analyze_companies_async(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Dispatch bulk website analysis to SQS worker. Returns job_id to poll."""
    user_id = get_user_id(authorization)
    job_id = dispatch_job("bulk_analyze", user_id, {
        "company_ids":     payload.get("company_ids", []),
        "gemini_key":      payload.get("gemini_key", ""),
        "openai_key":      payload.get("openai_key", ""),
        "groq_key":        payload.get("groq_key", ""),
        "openrouter_key":  payload.get("openrouter_key", ""),
        "openrouter_model": payload.get("openrouter_model", ""),
    }, supabase)
    return {"job_id": job_id, "status": "queued"}


@router.post("/companies/bulk-maps-enrich/async")
async def bulk_maps_enrich_async(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Dispatch bulk Maps enrichment to SQS worker. Returns job_id to poll."""
    user_id = get_user_id(authorization)
    job_id = dispatch_job("bulk_maps_enrich", user_id, {
        "company_ids": payload.get("company_ids", []),
        "maps_key":    payload.get("maps_key", ""),
    }, supabase)
    return {"job_id": job_id, "status": "queued"}


# ─── PROFILE ROUTES ─────────────────────────────────────────

@router.get("/profile")
async def get_profile(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("profiles").select(
        "id,email,full_name,mode,role,team_id,onboarding_complete,cal_link,cal_slug"
    ).eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data[0]


@router.get("/profile/cal")
async def get_cal_config(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("profiles").select("cal_link,cal_slug,full_name").eq("id", user_id).limit(1).execute()
    data = res.data[0] if res.data else {}
    return {"cal_link": data.get("cal_link"), "cal_slug": data.get("cal_slug"), "full_name": data.get("full_name")}


@router.patch("/profile/cal")
async def save_cal_config(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    cal_link = (payload.get("cal_link") or "").strip()
    cal_slug  = (payload.get("cal_slug") or "").strip().lower()

    # Sanitise slug: only alphanumeric + hyphens
    import re as _re2
    cal_slug = _re2.sub(r"[^a-z0-9\-]", "", cal_slug)[:40] if cal_slug else ""

    if cal_slug:
        # Check uniqueness (ignore self)
        existing = supabase.table("profiles").select("id").eq("cal_slug", cal_slug).neq("id", user_id).limit(1).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="That slug is already taken. Try another.")

    update: dict = {"cal_link": cal_link or None}
    if cal_slug:
        update["cal_slug"] = cal_slug

    supabase.table("profiles").update(update).eq("id", user_id).execute()
    return {"ok": True, "cal_link": cal_link or None, "cal_slug": cal_slug or None}


@router.get("/public/book/{slug}")
async def public_book_page(slug: str):
    """Public endpoint — returns profile info for the /book/:slug booking page."""
    slug = slug.strip().lower()
    profile = _first(supabase.table("profiles").select("full_name,cal_link,cal_slug").eq("cal_slug", slug).limit(1).execute())
    if not profile or not profile.get("cal_link"):
        raise HTTPException(status_code=404, detail="Booking page not found")
    return {"full_name": profile.get("full_name") or "Someone", "cal_link": profile["cal_link"], "slug": slug}


@router.post("/profile/setup")
async def setup_profile(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    mode = payload.get("mode")
    if mode not in ("solo", "team"):
        raise HTTPException(status_code=422, detail="mode must be 'solo' or 'team'")

    update: dict = {"mode": mode, "onboarding_complete": True}

    name = (payload.get("name") or "").strip()
    if name:
        update["full_name"] = name

    if mode == "team":
        team_name = (payload.get("team_name") or "").strip()
        if not team_name:
            raise HTTPException(status_code=422, detail="team_name is required for team mode")
        team_res = supabase.table("teams").insert({
            "name": team_name,
            "created_by": user_id,
        }).execute()
        if not team_res.data:
            raise HTTPException(status_code=500, detail="Failed to create team")
        update["team_id"] = team_res.data[0]["id"]
        update["role"] = "admin"

    supabase.table("profiles").update(update).eq("id", user_id).execute()
    return {"ok": True, "mode": mode}


# ─── ADMIN ROUTES ───────────────────────────────────────────

def _require_admin(user_id: str):
    row = _first(supabase.table("profiles").select("role,team_id").eq("id", user_id).limit(1).execute())
    if not row or row.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    team_id = row.get("team_id")
    if not team_id:
        raise HTTPException(status_code=403, detail="Not part of a team")
    return team_id

OWNER_USER_ID = os.environ.get("OWNER_USER_ID", "5c9c0565-cec6-40ba-887a-84b665c40a44")

def _require_owner(user_id: str):
    if user_id != OWNER_USER_ID:
        raise HTTPException(status_code=403, detail="Owner access required")


@router.get("/admin/members")
async def list_members(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)
    res = supabase.table("profiles").select(
        "id,email,full_name,role"
    ).eq("team_id", team_id).execute()
    return res.data or []


@router.get("/admin/invites")
async def list_invites(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)
    res = supabase.table("team_invites").select(
        "id,email,role,status,created_at"
    ).eq("team_id", team_id).eq("status", "pending").execute()
    return res.data or []


@router.post("/admin/invite")
async def invite_member(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role", "member")
    if not email:
        raise HTTPException(status_code=422, detail="email required")
    if role not in ("admin", "member"):
        raise HTTPException(status_code=422, detail="role must be 'admin' or 'member'")
    existing = supabase.table("team_invites").select("id").eq("team_id", team_id).eq("email", email).eq("status", "pending").execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Invite already pending for this email")
    supabase.table("team_invites").insert({
        "team_id": team_id,
        "email": email,
        "role": role,
        "status": "pending",
        "invited_by": user_id,
    }).execute()
    return {"ok": True}


@router.patch("/admin/members/{member_id}")
async def update_member_role(member_id: str, payload: dict, authorization: str = Header(...)):
    validate_uuid(member_id, "member_id")
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)
    if member_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    role = payload.get("role")
    if role not in ("admin", "member"):
        raise HTTPException(status_code=422, detail="role must be 'admin' or 'member'")
    supabase.table("profiles").update({"role": role}).eq("id", member_id).eq("team_id", team_id).execute()
    return {"ok": True}


@router.delete("/admin/members/{member_id}")
async def remove_member(member_id: str, authorization: str = Header(...)):
    validate_uuid(member_id, "member_id")
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)
    if member_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    supabase.table("profiles").update({"team_id": None, "role": "admin"}).eq("id", member_id).eq("team_id", team_id).execute()
    return {"ok": True}


@router.delete("/admin/invites/{invite_id}")
async def revoke_invite(invite_id: str, authorization: str = Header(...)):
    validate_uuid(invite_id, "invite_id")
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)
    supabase.table("team_invites").update({"status": "revoked"}).eq("id", invite_id).eq("team_id", team_id).execute()
    return {"ok": True}


@router.post("/admin/create-user")
async def create_user(payload: dict, authorization: str = Header(...)):
    """Directly create a new user account (admin only). Sets email, password, name and role."""
    user_id = get_user_id(authorization)
    team_id = _require_admin(user_id)

    email    = (payload.get("email") or "").strip().lower()
    password = (payload.get("password") or "").strip()
    name     = (payload.get("name") or "").strip()
    role     = payload.get("role", "member")

    if not email or not password:
        raise HTTPException(status_code=422, detail="email and password are required")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if role not in ("member", "admin"):
        raise HTTPException(status_code=422, detail="role must be 'member' or 'admin'")

    # Create auth user using service-role client (bypasses email confirmation)
    try:
        resp = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,   # mark as confirmed immediately
            "user_metadata": {"full_name": name},
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    new_id = resp.user.id if resp.user else None
    if not new_id:
        raise HTTPException(status_code=500, detail="User creation returned no ID")

    # Upsert profile and assign to same team
    supabase.table("profiles").upsert({
        "id":        new_id,
        "email":     email,
        "full_name": name,
        "role":      role,
        "team_id":   team_id,
    }).execute()

    posthog.capture(user_id, "admin_user_created", {"new_user": email, "role": role})
    return {"ok": True, "user_id": new_id, "email": email}


@router.delete("/admin/users/{target_id}")
async def delete_user(target_id: str, authorization: str = Header(...)):
    """Permanently delete a user account (admin only)."""
    validate_uuid(target_id, "target_id")
    user_id = get_user_id(authorization)
    _require_admin(user_id)
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    try:
        supabase.auth.admin.delete_user(target_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    supabase.table("profiles").delete().eq("id", target_id).execute()
    posthog.capture(user_id, "admin_user_deleted", {"deleted_id": target_id})
    return {"ok": True}


DISCORD_WEBHOOKS = {
    "engineering": os.environ.get("DISCORD_ENGINEERING_WEBHOOK", ""),
    "design":      os.environ.get("DISCORD_DESIGN_WEBHOOK", ""),
    "product":     os.environ.get("DISCORD_PRODUCT_WEBHOOK", ""),
}

@router.post("/admin/discord")
async def post_discord(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_owner(user_id)
    channel = payload.get("channel", "engineering")
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="message is required")
    webhook_url = DISCORD_WEBHOOKS.get(channel)
    if not webhook_url:
        raise HTTPException(status_code=500, detail=f"Webhook not configured for #{channel}")
    res = requests.post(webhook_url, json={"content": message}, timeout=8)
    if res.status_code not in (200, 204):
        raise HTTPException(status_code=502, detail="Discord delivery failed")
    return {"ok": True}


@router.post("/admin/github-invite")
async def github_invite(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_owner(user_id)
    username = (payload.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=422, detail="username is required")
    token = os.environ.get("GITHUB_COLLAB_TOKEN", "")
    if not token:
        raise HTTPException(status_code=500, detail="GITHUB_COLLAB_TOKEN not configured")
    res = requests.put(
        f"https://api.github.com/repos/sxrxvxnn/leadgen-platform/collaborators/{username}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        json={"permission": "push"},
        timeout=10,
    )
    if res.status_code == 201:
        return {"status": "invited"}
    if res.status_code == 204:
        return {"status": "already_member"}
    if res.status_code == 404:
        raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found")
    raise HTTPException(status_code=502, detail="GitHub API error")


# ─── PHASE 1: ADVANCED LEAD SEARCH ──────────────────────────────────────────

@router.get("/leads/search")
async def search_leads(
    authorization: str = Header(...),
    q: str = "",
    industry: str = "",
    size: str = "",
    location: str = "",
    seniority: str = "",
    connection_status: str = "",
    starred: str = "",
    min_score: int = 0,
    max_score: int = 100,
):
    user_id = get_user_id(authorization)
    query = supabase.table("leads").select("*").eq("user_id", user_id)

    if q:
        query = query.or_(f"name.ilike.%{q}%,title.ilike.%{q}%,company.ilike.%{q}%,email.ilike.%{q}%")
    if industry:
        query = query.ilike("company", f"%{industry}%")
    if location:
        query = query.ilike("location", f"%{location}%")
    if connection_status:
        query = query.eq("connection_status", connection_status)
    if starred == "true":
        query = query.eq("starred", True)

    SENIORITY_KEYWORDS = {
        "c-suite":    ["CEO","CTO","CFO","COO","CRO","CPO","CISO","Chief"],
        "vp":         ["VP","Vice President","SVP","EVP"],
        "director":   ["Director","Head of"],
        "manager":    ["Manager","Lead","Senior Manager"],
        "individual": ["Engineer","Developer","Analyst","Specialist","Associate"],
    }
    if seniority and seniority in SENIORITY_KEYWORDS:
        keywords = SENIORITY_KEYWORDS[seniority]
        filter_str = ",".join(f"title.ilike.%{kw}%" for kw in keywords)
        query = query.or_(filter_str)

    res = query.order("created_at", desc=True).execute()
    leads = res.data or []

    # score filter applied in Python (score may be null)
    if min_score > 0 or max_score < 100:
        leads = [
            l for l in leads
            if (l.get("icp_score") or 0) >= min_score
            and (l.get("icp_score") or 0) <= max_score
        ]

    return {"leads": leads, "total": len(leads)}


# ─── PHASE 1: AI LEAD SCORING ────────────────────────────────────────────────

@router.post("/leads/score")
async def score_leads(payload: dict, authorization: str = Header(...)):
    """Score all unscoredleads for the user using AI."""
    user_id = get_user_id(authorization)

    groq_key = os.environ.get("GROQ_API_KEY", "")
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")

    if not (groq_key or gemini_key or openrouter_key):
        raise HTTPException(status_code=500, detail="No AI API key configured")

    # Fetch leads that need scoring (or rescore flag)
    rescore = payload.get("rescore", False)
    leads_query = supabase.table("leads").select("*").eq("user_id", user_id)
    if not rescore:
        leads_query = leads_query.is_("icp_score", "null")
    leads_res = leads_query.limit(50).execute()
    leads = leads_res.data or []

    if not leads:
        return {"scored": 0, "message": "All leads already scored. Pass rescore=true to re-score."}

    # Fetch ICP profiles for context
    icp_res = supabase.table("icp_profiles").select("*").eq("user_id", user_id).execute()
    icp_profiles = icp_res.data or []
    icp_context = ""
    if icp_profiles:
        icp_context = "Ideal Customer Profile:\n" + "\n".join(
            f"- {p.get('name','')}: {p.get('description','')}" for p in icp_profiles
        )

    scored = 0
    for lead in leads:
        prompt = f"""You are a B2B sales scoring assistant. Score this lead from 0-100 based on how well they fit the ICP.

{icp_context if icp_context else "No ICP defined — score based on general B2B value signals."}

Lead details:
- Name: {lead.get('name','')}
- Title: {lead.get('title','')}
- Company: {lead.get('company','')}
- Location: {lead.get('location','')}
- About: {lead.get('about','')[:300] if lead.get('about') else ''}
- Employee count: {lead.get('employee_count','')}
- Revenue: {lead.get('revenue','')}

Respond in this exact JSON format (no markdown):
{{"score": <0-100>, "reason": "<2-3 sentence explanation of the score>"}}"""

        try:
            result = None
            if groq_key:
                import httpx
                r = httpx.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={"model": "llama3-8b-8192", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 200},
                    timeout=15,
                )
                if r.status_code == 200:
                    content = r.json()["choices"][0]["message"]["content"].strip()
                    import json as _json
                    result = _json.loads(content)

            if result and isinstance(result.get("score"), (int, float)):
                supabase.table("leads").update({
                    "icp_score": int(result["score"]),
                    "icp_score_reason": result.get("reason", ""),
                }).eq("id", lead["id"]).execute()
                scored += 1
        except Exception:
            continue

    return {"scored": scored, "total": len(leads)}


# ─── AI SEQUENCE DRAFTING ────────────────────────────────────────────────────

@router.post("/sequences/ai-draft")
async def ai_draft_sequence(payload: dict, authorization: str = Header(...)):
    """Generate a cold email sequence using AI (Groq llama-3.1-70b-versatile)."""
    get_user_id(authorization)  # auth check

    product   = (payload.get("product") or "").strip()[:500]
    persona   = (payload.get("persona") or "").strip()[:300]
    tone      = (payload.get("tone") or "professional").strip()
    num_steps = min(max(int(payload.get("num_steps") or 3), 2), 5)

    if not product:
        raise HTTPException(status_code=422, detail="product is required")

    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=503, detail="AI drafting not configured on this server.")

    prompt = f"""You are an expert cold email copywriter for B2B SaaS.
Write a {num_steps}-step cold email sequence with the following parameters:
- Product/value prop: {product}
- Target persona: {persona or "B2B decision makers"}
- Tone: {tone}

Rules:
- Step 1 is sent on Day 0, subsequent steps add 3–5 day delays
- Keep emails short (under 150 words each)
- Use personalization tokens exactly as written: {{{{name}}}}, {{{{first_name}}}}, {{{{company}}}}, {{{{title}}}}, {{{{cal_link}}}}
- No generic spam phrases ("hope this finds you well", "touching base")
- Each email should have a clear single CTA
- Last email should be a break-up email ("closing the loop")

Return ONLY valid JSON in this exact structure, no explanation:
{{
  "steps": [
    {{"delay_days": 0, "subject": "...", "body": "..."}},
    {{"delay_days": 4, "subject": "Re: ...", "body": "..."}},
    ...
  ]
}}"""

    try:
        import requests as _req, json as _j
        r = _req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "max_tokens": 1800, "temperature": 0.7},
            timeout=30,
        )
        d = r.json()
        raw = d["choices"][0]["message"]["content"].strip()
        # Strip markdown code fences if present
        import re as _re2
        raw = _re2.sub(r'^```(?:json)?\s*', '', raw)
        raw = _re2.sub(r'\s*```$', '', raw)
        data = _j.loads(raw)
        steps = data.get("steps") or []
        # Validate and ensure type field
        for step in steps:
            step["type"] = "email"
            step.setdefault("delay_days", 0)
        return {"steps": steps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI draft failed: {str(e)}")


# ─── SEND STATS ──────────────────────────────────────────────────────────────

@router.get("/sequences/send-stats")
async def sequence_send_stats(authorization: str = Header(...)):
    """Return today's email send count and daily limit for the dashboard."""
    import datetime as _dt
    user_id = get_user_id(authorization)
    today_start = _dt.datetime.now(_dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    ct = supabase.table("email_tracking").select("id", count="exact").eq("user_id", user_id).gte("sent_at", today_start).execute()
    sent_today = ct.count or 0
    return {"sent_today": sent_today, "daily_limit": 50, "remaining": max(0, 50 - sent_today)}


# ─── SEQUENCE TEMPLATES ──────────────────────────────────────────────────────

_SEQUENCE_TEMPLATES = [
    {
        "id": "saas-cold-outreach", "name": "SaaS Cold Outreach",
        "description": "3-step cadence for selling a SaaS product to decision makers. Soft ask → value proof → breakup.",
        "tags": ["SaaS", "B2B", "Product"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "Quick question, {{first_name}}",
             "body": "Hi {{first_name}},\n\nI'll keep this short — I help companies like {{company}} [solve X] without [painful Y].\n\nWorth 15 minutes this week?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 3,
             "subject": "Re: Quick question, {{first_name}}",
             "body": "Hi {{first_name}},\n\nCircling back in case my last note got buried.\n\nAs a {{title}}, [specific pain point] is probably on your radar. We solved exactly that for [similar company].\n\nWorth a look?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 3, "type": "email", "delay_days": 5,
             "subject": "Closing the loop",
             "body": "Hi {{first_name}},\n\nLeaving the ball in your court. If timing isn't right, no worries.\n\nMy calendar is always open when you're ready: {{cal_link}}\n\n{{name}}"},
        ],
    },
    {
        "id": "agency-intro", "name": "Agency / Services Intro",
        "description": "3-step value-first sequence for agencies introducing their services to prospects.",
        "tags": ["Agency", "Services", "B2B"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "Growth idea for {{company}}",
             "body": "Hi {{first_name}},\n\nI came across {{company}} and had a few ideas for [specific growth lever].\n\nWe helped [similar client] achieve [result] in [timeframe].\n\nOpen to a 20-minute call?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 4,
             "subject": "Re: Growth idea for {{company}}",
             "body": "Hi {{first_name}},\n\nFollowing up from last week. I put together a quick teardown of {{company}}'s [specific area] — happy to share if useful.\n\nJust reply yes and I'll send it over.\n\n{{name}}"},
            {"step_number": 3, "type": "email", "delay_days": 6,
             "subject": "Last note — {{company}}",
             "body": "Hi {{first_name}},\n\nThis will be my last email. If timing ever works, feel free to reach out.\n\n{{cal_link}}\n\nAll the best to you and the {{company}} team,\n{{name}}"},
        ],
    },
    {
        "id": "partnership-outreach", "name": "Partnership / BD Outreach",
        "description": "3-step sequence for proposing integrations, co-marketing, or channel partnerships.",
        "tags": ["Partnership", "BD", "Collaboration"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "Partnership idea — {{company}} × [Your Co]",
             "body": "Hi {{first_name}},\n\nI've been following {{company}}'s work and see a strong overlap with what we're doing at [Your Co].\n\nI think there's an opportunity to [co-market / integrate / refer customers] to mutual benefit.\n\nOpen to a 20-minute call?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 5,
             "subject": "Re: Partnership idea",
             "body": "Hi {{first_name}},\n\nDropping a quick follow-up. Here's a sketch of what a partnership could look like:\n\n• [Benefit 1]\n• [Benefit 2]\n• [Benefit 3]\n\nHappy to put together a brief if helpful.\n\n{{name}}"},
            {"step_number": 3, "type": "email", "delay_days": 7,
             "subject": "One last ping",
             "body": "Hi {{first_name}},\n\nLast one from me — I know these land at the wrong time sometimes.\n\nIf partnerships ever become a priority at {{company}}, I'd love to reconnect.\n\n{{cal_link}}\n\nTake care,\n{{name}}"},
        ],
    },
    {
        "id": "re-engagement", "name": "Re-engagement",
        "description": "2-step sequence to warm up leads who showed early interest but went cold.",
        "tags": ["Re-engagement", "Warm leads"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "Still relevant, {{first_name}}?",
             "body": "Hi {{first_name}},\n\nWe connected a while back and I wanted to check in. A lot has changed — [specific update about your offering].\n\nIs this still something on your radar at {{company}}?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 5,
             "subject": "Closing the loop",
             "body": "Hi {{first_name}},\n\nJust closing the loop. If priorities have shifted, no problem at all.\n\nI'm here whenever the timing is better.\n\n{{cal_link}}\n\nBest,\n{{name}}"},
        ],
    },
    {
        "id": "new-role-congrats", "name": "New Role Congratulations",
        "description": "2-step trigger sequence for leads who recently changed jobs — highest-converting outreach timing.",
        "tags": ["Trigger", "Job change", "Warm"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "Congrats on the new role, {{first_name}}",
             "body": "Hi {{first_name}},\n\nCongratulations on your new role as {{title}} at {{company}}!\n\nFirst 90 days in a new seat are when [problem you solve] usually becomes a priority. Would love to show you how we help [outcome].\n\nWorth 15 minutes?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 5,
             "subject": "Quick question for your new role",
             "body": "Hi {{first_name}},\n\nFollowing up — I know first weeks in a new role are hectic.\n\nHappy to connect whenever works.\n\n{{cal_link}}\n\n{{name}}"},
        ],
    },
    {
        "id": "inbound-follow-up", "name": "Inbound Lead Follow-up",
        "description": "3-step sequence for leads who signed up or showed interest but didn't convert.",
        "tags": ["Inbound", "Follow-up", "Warm"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "Following up on your interest",
             "body": "Hi {{first_name}},\n\nThanks for checking us out — wanted to reach out personally.\n\nI'd love to help you get [value] faster. Do you have 20 minutes this week?\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 2,
             "subject": "Quick tip for {{company}}",
             "body": "Hi {{first_name}},\n\nMost companies like {{company}} start with [use case] — it's the fastest path to value.\n\nWant me to walk you through it? 20 minutes.\n\n{{cal_link}}\n\n{{name}}"},
            {"step_number": 3, "type": "email", "delay_days": 4,
             "subject": "Checking in one last time",
             "body": "Hi {{first_name}},\n\nIs [your offering] still on your radar, or should I check back at a different time?\n\nEither answer is fine.\n\n{{cal_link}}\n\n{{name}}"},
        ],
    },
    {
        "id": "event-invite", "name": "Event / Webinar Invite",
        "description": "3-step invite sequence with a reminder and last-chance email.",
        "tags": ["Event", "Webinar", "Invite"],
        "steps": [
            {"step_number": 1, "type": "email", "delay_days": 0,
             "subject": "You might like this, {{first_name}}",
             "body": "Hi {{first_name}},\n\nWe're hosting a [webinar/event] on [Topic] — built for [{{title}}s at companies like {{company}}].\n\nDate: [Date & Time]\nKey takeaways: [3 bullets]\n\nRegister here: [link]\n\nHope to see you there!\n{{name}}"},
            {"step_number": 2, "type": "email", "delay_days": 3,
             "subject": "Reminder: [Event] is [X days] away",
             "body": "Hi {{first_name}},\n\nJust a reminder that [Event] is coming up on [Date]. [X] companies similar to {{company}} have already registered.\n\nGrab your spot: [link]\n\nSee you there,\n{{name}}"},
            {"step_number": 3, "type": "email", "delay_days": 2,
             "subject": "Last chance — [Event] today",
             "body": "Hi {{first_name}},\n\nToday's the day! Join us here: [link]\n\nCan't make it live? Register anyway and we'll send the recording.\n\n{{name}}"},
        ],
    },
]


@router.get("/sequences/templates")
async def list_sequence_templates(authorization: str = Header(...)):
    """Return built-in sequence templates."""
    get_user_id(authorization)
    return {"templates": _SEQUENCE_TEMPLATES}


@router.post("/sequences/from-template")
async def create_sequence_from_template(payload: dict, authorization: str = Header(...)):
    """Create a new sequence (with steps) from a built-in template."""
    user_id = get_user_id(authorization)
    template_id = payload.get("template_id", "")
    tpl = next((t for t in _SEQUENCE_TEMPLATES if t["id"] == template_id), None)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    name = payload.get("name") or tpl["name"]
    seq_res = supabase.table("sequences").insert({
        "user_id": user_id,
        "name":    name,
        "active":  False,
    }).execute()
    seq = seq_res.data[0]
    seq_id = seq["id"]

    for step in tpl["steps"]:
        supabase.table("sequence_steps").insert({
            "sequence_id":  seq_id,
            "user_id":      user_id,
            "step_number":  step["step_number"],
            "type":         step["type"],
            "delay_days":   step["delay_days"],
            "subject":      step.get("subject", ""),
            "body":         step.get("body", ""),
        }).execute()

    posthog.capture(user_id, "sequence_created_from_template", {"template_id": template_id})
    return {"sequence": seq, "steps_created": len(tpl["steps"])}


# ─── PHASE 1: SEQUENCES CRUD ─────────────────────────────────────────────────

@router.get("/sequences")
async def list_sequences(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("sequences").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    sequences = res.data or []
    for seq in sequences:
        steps_res = supabase.table("sequence_steps").select("*").eq("sequence_id", seq["id"]).order("step_number").execute()
        seq["steps"] = steps_res.data or []
        enr_res = supabase.table("sequence_enrollments").select("id, status").eq("sequence_id", seq["id"]).execute()
        enr = enr_res.data or []
        seq["enrolled_count"] = len(enr)
        seq["replied_count"]  = sum(1 for e in enr if e["status"] == "replied")
        seq["bounced_count"]  = sum(1 for e in enr if e["status"] == "bounced")
        seq["active_count"]   = sum(1 for e in enr if e["status"] == "active")
        seq["completed_count"]= sum(1 for e in enr if e["status"] == "completed")
    return {"sequences": sequences}


@router.post("/sequences")
async def create_sequence(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    res = supabase.table("sequences").insert({
        "user_id": user_id,
        "name": name,
        "description": payload.get("description", ""),
        "status": "draft",
    }).execute()
    seq = res.data[0]
    steps = payload.get("steps", [])
    for i, step in enumerate(steps):
        supabase.table("sequence_steps").insert({
            "subject_b": step.get("subject_b") or None,
            "body_b":    step.get("body_b") or None,
            "sequence_id": seq["id"],
            "step_number": i + 1,
            "type": step.get("type", "email"),
            "delay_days": step.get("delay_days", 0),
            "subject": step.get("subject", ""),
            "body": step.get("body", ""),
        }).execute()
    seq["steps"] = steps
    return seq


@router.patch("/sequences/{seq_id}")
async def update_sequence(seq_id: str, payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    allowed = {k: v for k, v in payload.items() if k in ("name", "description", "status")}
    if allowed:
        allowed["updated_at"] = "now()"
        supabase.table("sequences").update(allowed).eq("id", seq_id).eq("user_id", user_id).execute()
    if "steps" in payload:
        supabase.table("sequence_steps").delete().eq("sequence_id", seq_id).execute()
        for i, step in enumerate(payload["steps"]):
            supabase.table("sequence_steps").insert({
                "sequence_id": seq_id,
                "step_number": i + 1,
                "type":        step.get("type", "email"),
                "delay_days":  step.get("delay_days", 0),
                "subject":     step.get("subject", ""),
                "body":        step.get("body", ""),
                "subject_b":   step.get("subject_b") or None,
                "body_b":      step.get("body_b") or None,
            }).execute()
    return {"ok": True}


@router.delete("/sequences/{seq_id}")
async def delete_sequence(seq_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("sequences").delete().eq("id", seq_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/sequences/{seq_id}/enroll")
async def enroll_leads(seq_id: str, payload: dict, authorization: str = Header(...)):
    import datetime as _dt
    user_id = get_user_id(authorization)
    lead_ids = payload.get("lead_ids", [])
    if not lead_ids:
        raise HTTPException(status_code=422, detail="lead_ids required")
    # Get first step delay to set next_run_at
    steps_res = supabase.table("sequence_steps").select("step_number,delay_days").eq("sequence_id", seq_id).order("step_number").limit(1).execute()
    first_step = (steps_res.data or [{}])[0]
    delay_days = first_step.get("delay_days") or 0
    next_run = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=delay_days)).isoformat()
    # Detect if any steps have A/B variant content
    all_steps_res = supabase.table("sequence_steps").select("subject_b").eq("sequence_id", seq_id).execute()
    has_ab = any(s.get("subject_b") for s in (all_steps_res.data or []))

    import random as _random
    enrolled = 0
    skipped = 0
    for lead_id in lead_ids:
        try:
            ab_variant = _random.choice(["A", "B"]) if has_ab else None
            supabase.table("sequence_enrollments").insert({
                "sequence_id": seq_id,
                "lead_id":     lead_id,
                "user_id":     user_id,
                "status":      "active",
                "current_step": 1,
                "next_run_at": next_run,
                "ab_variant":  ab_variant,
            }).execute()
            enrolled += 1
        except Exception:
            skipped += 1
    return {"enrolled": enrolled, "skipped": skipped}


@router.get("/sequences/{seq_id}/enrollments")
async def list_enrollments(seq_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("sequence_enrollments").select(
        "id, lead_id, status, current_step, next_run_at, last_error, enrolled_at, completed_at, replied_at, ab_variant, reply_sentiment, ooo_resume_at, leads(name, email, company, title)"
    ).eq("sequence_id", seq_id).eq("user_id", user_id).order("enrolled_at", desc=True).execute()
    return {"enrollments": res.data or []}


@router.delete("/sequences/{seq_id}/enrollments/{enrollment_id}")
async def unenroll_lead(seq_id: str, enrollment_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(enrollment_id)
    supabase.table("sequence_enrollments").delete().eq("id", enrollment_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/sequences/process-cron")
async def process_sequence_cron(request: Request):
    """Cron endpoint — processes all due sequence enrollments."""
    verify_cron_auth(request)
    import datetime as _dt
    import smtplib as _smtplib
    import urllib.parse as _urlparse
    from email.mime.text import MIMEText as _MIMEText
    from email.mime.multipart import MIMEMultipart as _MIMEMultipart

    cron_secret = os.environ.get("CRON_SECRET", "")
    auth_header = request.headers.get("authorization", "")
    provided = auth_header.replace("Bearer ", "").strip()
    if cron_secret and provided != cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = _dt.datetime.now(_dt.timezone.utc)
    now_iso = now.isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Auto-resume OOO-paused enrollments whose wait period has expired
    try:
        ooo_res = supabase.table("sequence_enrollments").select("id").eq("status", "paused").not_.is_("ooo_resume_at", "null").lte("ooo_resume_at", now_iso).execute()
        for ooo_enr in (ooo_res.data or []):
            supabase.table("sequence_enrollments").update({
                "status": "active", "ooo_resume_at": None, "last_error": None,
            }).eq("id", ooo_enr["id"]).execute()
    except Exception:
        pass

    due_res = supabase.table("sequence_enrollments").select(
        "id, sequence_id, lead_id, user_id, status, current_step, leads(name, email, company, title, timezone, location_country)"
    ).eq("status", "active").lte("next_run_at", now_iso).limit(50).execute()
    due = due_res.data or []
    processed = 0
    errors = 0

    # Pre-compute per-user daily send counts to enforce rate limiting
    _DAILY_LIMIT = 50
    unique_uids = list({e["user_id"] for e in due})
    user_sent_today: dict = {}
    for _uid in unique_uids:
        try:
            ct = supabase.table("email_tracking").select("id", count="exact").eq("user_id", _uid).gte("created_at", today_start).execute()
            user_sent_today[_uid] = ct.count or 0
        except Exception:
            user_sent_today[_uid] = 0
    skipped_rate = 0

    def _personalize(text, name, first, company, title, cal_link=""):
        return (
            (text or "")
            .replace("{{name}}", name)
            .replace("{{first_name}}", first)
            .replace("{{company}}", company)
            .replace("{{title}}", title)
            .replace("{{cal_link}}", cal_link)
        )

    def _wrap_links(text, tracking_id):
        def _sub(m):
            raw = m.group(0)
            if "track/open" in raw or "unsubscribe" in raw:
                return raw
            encoded = _urlparse.quote(raw, safe='')
            return f"{_API_BASE}/track/click/{tracking_id}?url={encoded}"
        return _re.sub(r'https?://[^\s\)\"\'<>\]]+', _sub, text)

    def _is_hard_bounce(exc):
        msg = str(exc).lower()
        return any(k in msg for k in ("550", "551", "552", "553", "554", "user unknown", "no such user", "does not exist", "invalid address", "mailbox not found"))

    skipped_tz = 0

    def _in_business_hours(tz_name: str) -> bool:
        """Return True if it's Mon–Fri 8am–6pm in the given IANA timezone."""
        try:
            import zoneinfo as _zi
            local = now.astimezone(_zi.ZoneInfo(tz_name))
            return local.weekday() < 5 and 8 <= local.hour < 18
        except Exception:
            return True  # Unknown TZ → don't block

    for enrollment in due:
        enr_id     = enrollment["id"]
        seq_id     = enrollment["sequence_id"]
        user_id    = enrollment["user_id"]
        step_num   = enrollment["current_step"]
        lead       = enrollment.get("leads") or {}
        lead_name  = lead.get("name") or ""
        lead_first = lead_name.split()[0] if lead_name else ""
        lead_email = lead.get("email") or ""
        lead_company = lead.get("company") or ""
        lead_title = lead.get("title") or ""

        # Timezone-aware sending: skip if outside business hours for this lead
        lead_tz = lead.get("timezone") or _COUNTRY_TZ.get((lead.get("location_country") or "").upper(), "")
        if lead_tz and not _in_business_hours(lead_tz):
            skipped_tz += 1
            continue

        try:
            steps_res = supabase.table("sequence_steps").select("*").eq("sequence_id", seq_id).order("step_number").execute()
            steps = steps_res.data or []
            current_step = next((s for s in steps if s["step_number"] == step_num), None)

            if not current_step:
                supabase.table("sequence_enrollments").update({"status": "completed", "completed_at": now_iso}).eq("id", enr_id).execute()
                processed += 1
                continue

            step_type = current_step.get("type", "email")
            success   = True
            error_msg = None

            if step_type == "email":
                if not lead_email:
                    error_msg = "Lead has no email"
                    success   = False
                elif user_sent_today.get(user_id, 0) >= _DAILY_LIMIT:
                    # Rate limit hit — skip this enrollment; cron will retry it tomorrow
                    skipped_rate += 1
                    continue
                else:
                    # Check unsubscribe
                    unsub = supabase.table("unsubscribes").select("id").eq("user_id", user_id).eq("email", lead_email).limit(1).execute()
                    if unsub.data:
                        supabase.table("sequence_enrollments").update({"status": "unsubscribed", "last_error": "Unsubscribed"}).eq("id", enr_id).execute()
                        processed += 1
                        continue

                    profile_data = _first(supabase.table("profiles").select("smtp_config,cal_link,cal_slug").eq("id", user_id).limit(1).execute()) or {}
                    smtp = profile_data.get("smtp_config") or {}
                    cal_slug = profile_data.get("cal_slug") or ""
                    cal_link = profile_data.get("cal_link") or ""
                    # Use the branded /book/ URL if slug is set, else raw cal_link
                    cal_token = f"https://sonarleads.vercel.app/book/{cal_slug}" if cal_slug else cal_link

                    if not smtp.get("smtp_user") or not smtp.get("smtp_pass"):
                        error_msg = "No SMTP credentials saved. Go to Settings → Sequence Automation."
                        success   = False
                    else:
                        ab_variant  = enrollment.get("ab_variant") or "A"
                        use_b       = (ab_variant == "B" and current_step.get("subject_b"))
                        subject_raw = current_step.get("subject_b" if use_b else "subject") or ""
                        body_raw    = current_step.get("body_b"    if use_b else "body")    or ""
                        subject = _personalize(subject_raw, lead_name, lead_first, lead_company, lead_title, cal_token)
                        body    = _personalize(body_raw,    lead_name, lead_first, lead_company, lead_title, cal_token)

                        # Generate tracking id & build pixel + unsubscribe token
                        tracking_id = secrets.token_urlsafe(20)
                        unsub_token = secrets.token_urlsafe(24)
                        pixel_url   = f"{_API_BASE}/track/open/{tracking_id}"
                        unsub_url   = f"{_API_BASE}/unsubscribe?token={unsub_token}&uid={user_id}&email={_urlparse.quote(lead_email)}"

                        # Wrap links for click tracking, append pixel + unsubscribe footer
                        tracked_body = _wrap_links(body, tracking_id)
                        tracked_body += f"\n\n---\nTo unsubscribe, click here: {unsub_url}"
                        tracked_body_html = tracked_body + f'\n<img src="{pixel_url}" width="1" height="1" alt="" style="display:none">'

                        try:
                            from_email = smtp.get("from_email") or smtp["smtp_user"]
                            from_name  = smtp.get("from_name") or ""
                            message_id = f"<{tracking_id}@sonarleads.app>"
                            msg = _MIMEMultipart("alternative")
                            msg["Subject"]             = subject
                            msg["From"]                = f"{from_name} <{from_email}>" if from_name else from_email
                            msg["To"]                  = lead_email
                            msg["Message-ID"]          = message_id
                            msg["X-Unsubscribe-Token"] = unsub_token
                            msg["List-Unsubscribe"]    = f"<{unsub_url}>"
                            msg.attach(_MIMEText(tracked_body, "plain"))

                            smtp_host = smtp.get("smtp_host", "smtp.gmail.com")
                            smtp_port = int(smtp.get("smtp_port", 587))
                            with _smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
                                srv.ehlo()
                                srv.starttls()
                                srv.login(smtp["smtp_user"], smtp["smtp_pass"])
                                srv.sendmail(from_email, lead_email, msg.as_string())

                            # Increment per-user daily counter
                            user_sent_today[user_id] = user_sent_today.get(user_id, 0) + 1

                            # Record in email_tracking for analytics
                            supabase.table("email_tracking").insert({
                                "user_id":       user_id,
                                "lead_id":       enrollment["lead_id"],
                                "tracking_id":   tracking_id,
                                "message_id":    message_id,
                                "subject":       subject,
                                "body_preview":  body[:120],
                                "sequence_id":   seq_id,
                                "enrollment_id": enr_id,
                                "step_number":   step_num,
                                "ab_variant":    ab_variant,
                            }).execute()

                            # Log activity
                            supabase.table("lead_activity").insert({
                                "lead_id":    enrollment["lead_id"],
                                "user_id":    user_id,
                                "event_type": "email_sent",
                                "data":       {"subject": subject, "to": lead_email, "via": "sequence", "sequence_id": seq_id, "step": step_num, "tracking_id": tracking_id},
                            }).execute()

                        except _smtplib.SMTPRecipientsRefused as e:
                            success   = False
                            error_msg = f"Hard bounce: {e}"
                            supabase.table("sequence_enrollments").update({"status": "bounced", "last_error": error_msg}).eq("id", enr_id).execute()
                            # Mark lead email as invalid + suppress future sends
                            try:
                                import datetime as _dt2
                                supabase.table("leads").update({"email_status": "invalid", "email_score": 0, "email_verified_at": _dt2.datetime.now(_dt2.timezone.utc).isoformat()}).eq("id", enrollment["lead_id"]).execute()
                                supabase.table("unsubscribes").upsert({"user_id": user_id, "email": lead_email, "reason": "hard_bounce"}, on_conflict="user_id,email").execute()
                            except Exception:
                                pass
                            # Hard bounce often signals a job change — flag it
                            try:
                                supabase.table("job_change_alerts").insert({
                                    "user_id": user_id, "lead_id": enrollment["lead_id"],
                                    "old_title": lead_title, "old_company": lead_company,
                                    "detected_via": "bounce",
                                }).execute()
                            except Exception:
                                pass
                            processed += 1
                            continue
                        except Exception as e:
                            success   = False
                            error_msg = str(e)
                            if _is_hard_bounce(e):
                                supabase.table("sequence_enrollments").update({"status": "bounced", "last_error": error_msg}).eq("id", enr_id).execute()
                                try:
                                    import datetime as _dt2
                                    supabase.table("leads").update({"email_status": "invalid", "email_score": 0, "email_verified_at": _dt2.datetime.now(_dt2.timezone.utc).isoformat()}).eq("id", enrollment["lead_id"]).execute()
                                    supabase.table("unsubscribes").upsert({"user_id": user_id, "email": lead_email, "reason": "hard_bounce"}, on_conflict="user_id,email").execute()
                                except Exception:
                                    pass
                                try:
                                    supabase.table("job_change_alerts").insert({
                                        "user_id": user_id, "lead_id": enrollment["lead_id"],
                                        "old_title": lead_title, "old_company": lead_company,
                                        "detected_via": "bounce",
                                    }).execute()
                                except Exception:
                                    pass
                                processed += 1
                                continue

            elif step_type in ("linkedin", "call", "task"):
                try:
                    supabase.table("tasks").insert({
                        "lead_id":   enrollment["lead_id"],
                        "user_id":   user_id,
                        "title":     f"[Sequence] {step_type.title()}: {lead_name or 'Lead'}",
                        "body":      current_step.get("body") or "",
                        "due_date":  now_iso,
                        "priority":  "high",
                        "completed": False,
                    }).execute()
                except Exception:
                    pass

            # Advance or complete
            next_steps = [s for s in steps if s["step_number"] > step_num]
            if next_steps:
                ns         = next_steps[0]
                next_delay = ns.get("delay_days") or 1
                next_run   = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=next_delay)).isoformat()
                upd        = {"current_step": ns["step_number"], "next_run_at": next_run}
                if not success and error_msg:
                    upd["last_error"] = error_msg
                supabase.table("sequence_enrollments").update(upd).eq("id", enr_id).execute()
            else:
                supabase.table("sequence_enrollments").update({"status": "completed", "completed_at": now_iso}).eq("id", enr_id).execute()

            processed += 1

        except Exception as ex:
            errors += 1
            try:
                supabase.table("sequence_enrollments").update({"last_error": str(ex)}).eq("id", enr_id).execute()
            except Exception:
                pass

    return {"processed": processed, "errors": errors, "total_due": len(due), "skipped_rate_limit": skipped_rate, "skipped_timezone": skipped_tz}


# ─── REPLY DETECTION CRON ────────────────────────────────────────────────────

@router.post("/sequences/check-replies")
async def check_sequence_replies(request: Request):
    """Cron: IMAP-poll each user's inbox for replies to sequence emails."""
    verify_cron_auth(request)
    import imaplib as _imap
    import email as _email_lib
    import datetime as _dt

    cron_secret = os.environ.get("CRON_SECRET", "")
    auth_header = request.headers.get("authorization", "")
    provided    = auth_header.replace("Bearer ", "").strip()
    if cron_secret and provided != cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    def _imap_host(smtp_host: str) -> str:
        h = (smtp_host or "").lower()
        if "gmail" in h:
            return "imap.gmail.com"
        if "outlook" in h or "office365" in h:
            return "outlook.office365.com"
        if "yahoo" in h:
            return "imap.mail.yahoo.com"
        if "zoho" in h:
            return "imap.zoho.com"
        if h.startswith("smtp."):
            return "imap." + h[5:]
        return h

    now     = _dt.datetime.now(_dt.timezone.utc)
    since   = (now - _dt.timedelta(days=14)).strftime("%d-%b-%Y")
    checked = 0
    found   = 0
    errors  = 0

    # Find all users with active enrollments
    active_res = supabase.table("sequence_enrollments").select("user_id").eq("status", "active").execute()
    user_ids   = list({r["user_id"] for r in (active_res.data or [])})

    for uid in user_ids:
        try:
            profile_res = _first(supabase.table("profiles").select("smtp_config").eq("id", uid).limit(1).execute()) or {}
            smtp = profile_res.get("smtp_config") or {}
            if not smtp.get("smtp_user") or not smtp.get("smtp_pass"):
                continue

            imap_server = _imap_host(smtp.get("smtp_host", "smtp.gmail.com"))
            smtp_user   = smtp["smtp_user"]
            smtp_pass   = smtp["smtp_pass"]

            # Fetch our sent message_ids for this user (last 14 days)
            track_res = supabase.table("email_tracking")\
                .select("message_id, enrollment_id, lead_id")\
                .eq("user_id", uid)\
                .not_.is_("message_id", "null")\
                .gte("created_at", (now - _dt.timedelta(days=14)).isoformat())\
                .execute()
            tracked = track_res.data or []
            if not tracked:
                continue

            # Build lookup: message_id → {enrollment_id, lead_id}
            mid_map = {r["message_id"]: r for r in tracked if r.get("message_id")}
            if not mid_map:
                continue

            # Connect via IMAP
            try:
                mail = _imap.IMAP4_SSL(imap_server, 993)
                mail.login(smtp_user, smtp_pass)
                mail.select("INBOX")
            except Exception as conn_err:
                errors += 1
                continue

            # Groq key for reply classification
            _groq_key_reply = os.environ.get("GROQ_API_KEY", "")

            def _classify_reply(body_text: str) -> str:
                """Classify a reply body into one of: interested, not_interested, ooo, wrong_person, other."""
                if not _groq_key_reply or not body_text.strip():
                    return "other"
                try:
                    import urllib.request as _ureq3, json as _jl3
                    classify_prompt = (
                        "Classify this email reply into exactly ONE category:\n"
                        "interested – wants to continue or learn more\n"
                        "not_interested – declines, unsubscribes, or says no\n"
                        "ooo – out-of-office auto-reply\n"
                        "wrong_person – not the right contact\n"
                        "other – anything else\n\n"
                        f"Reply:\n{body_text[:600]}\n\n"
                        "Reply with ONLY the category name."
                    )
                    pl = {"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": classify_prompt}], "max_tokens": 10, "temperature": 0}
                    req = _ureq3.Request("https://api.groq.com/openai/v1/chat/completions",
                        data=_jl3.dumps(pl).encode(),
                        headers={"Authorization": f"Bearer {_groq_key_reply}", "Content-Type": "application/json"},
                        method="POST")
                    with _ureq3.urlopen(req, timeout=8) as r:
                        resp = _jl3.loads(r.read())
                    raw_cat = resp["choices"][0]["message"]["content"].strip().lower().split()[0]
                    return raw_cat if raw_cat in ("interested", "not_interested", "ooo", "wrong_person", "other") else "other"
                except Exception:
                    return "other"

            def _extract_body(msg) -> str:
                """Extract plain-text body from a parsed email message."""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            try:
                                return part.get_payload(decode=True).decode("utf-8", errors="ignore")[:1500]
                            except Exception:
                                pass
                    return ""
                try:
                    return (msg.get_payload(decode=True) or b"").decode("utf-8", errors="ignore")[:1500]
                except Exception:
                    return ""

            try:
                _, data = mail.search(None, f'SINCE {since}')
                nums = data[0].split() if data and data[0] else []

                for num in nums:
                    try:
                        # Fetch full message so we can read the body for AI classification
                        _, raw_data = mail.fetch(num, "(RFC822)")
                        if not raw_data or not raw_data[0]:
                            continue
                        raw = raw_data[0][1]
                        parsed = _email_lib.message_from_bytes(raw)
                        in_reply_to = parsed.get("In-Reply-To", "").strip()
                        references  = parsed.get("References", "").strip()

                        # Look for any of our message_ids in these headers
                        matched = None
                        for mid, enr_info in mid_map.items():
                            if mid in in_reply_to or mid in references:
                                matched = enr_info
                                break

                        if not matched:
                            continue

                        enr_id  = matched["enrollment_id"]
                        lead_id = matched["lead_id"]

                        # Check enrollment is still active/paused before processing
                        enr_row = _first(supabase.table("sequence_enrollments")\
                            .select("status")\
                            .eq("id", enr_id)\
                            .limit(1).execute())
                        enr_status = (enr_row or {}).get("status")
                        if enr_status not in ("active", "paused"):
                            continue

                        # AI-classify the reply
                        reply_body   = _extract_body(parsed)
                        sentiment    = _classify_reply(reply_body)

                        if sentiment == "ooo":
                            # Pause and auto-resume in 14 days
                            resume_at = (now + _dt.timedelta(days=14)).isoformat()
                            supabase.table("sequence_enrollments").update({
                                "status":         "paused",
                                "reply_sentiment": "ooo",
                                "ooo_resume_at":   resume_at,
                                "last_error":      "OOO reply detected — auto-resuming in 14 days",
                            }).eq("id", enr_id).execute()
                        else:
                            supabase.table("sequence_enrollments").update({
                                "status":          "replied",
                                "replied_at":      now.isoformat(),
                                "reply_sentiment": sentiment,
                            }).eq("id", enr_id).execute()

                            # Auto-unsubscribe on explicit "not interested"
                            if sentiment == "not_interested":
                                try:
                                    lead_email_row = _first(supabase.table("leads").select("email").eq("id", lead_id).limit(1).execute())
                                    lead_email_addr = (lead_email_row or {}).get("email", "")
                                    if lead_email_addr:
                                        supabase.table("unsubscribes").upsert(
                                            {"user_id": uid, "email": lead_email_addr, "reason": "not_interested"},
                                            on_conflict="user_id,email"
                                        ).execute()
                                except Exception:
                                    pass

                        # Boost lead engagement score for any reply (+20)
                        try:
                            cur_e = _first(supabase.table("leads").select("engagement_score").eq("id", lead_id).limit(1).execute())
                            cur_es = (cur_e or {}).get("engagement_score") or 0
                            supabase.table("leads").update({
                                "engagement_score": min(100, cur_es + 20),
                                "last_engaged_at":  now.isoformat(),
                            }).eq("id", lead_id).execute()
                        except Exception:
                            pass

                        supabase.table("lead_activity").insert({
                            "lead_id":    lead_id,
                            "user_id":    uid,
                            "event_type": "email_reply_detected",
                            "data":       {"enrollment_id": enr_id, "detected_via": "imap", "sentiment": sentiment},
                        }).execute()

                        found += 1

                    except Exception:
                        pass

            finally:
                try:
                    mail.logout()
                except Exception:
                    pass

            checked += 1

        except Exception:
            errors += 1

    return {"users_checked": checked, "replies_found": found, "errors": errors}


# ─── JOB CHANGE ALERTS ───────────────────────────────────────────────────────

@router.get("/job-change-alerts")
async def list_job_change_alerts(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("job_change_alerts")\
        .select("*, leads(id, name, email, company, title, profile_url)")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .limit(50)\
        .execute()
    alerts = res.data or []
    unseen = sum(1 for a in alerts if not a.get("seen"))
    return {"alerts": alerts, "unseen": unseen}


@router.post("/job-change-alerts")
async def create_job_change_alert(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    lead_id = payload.get("lead_id", "")
    validate_uuid(lead_id, "lead_id")

    # Prevent duplicate alerts for same lead within 7 days
    import datetime as _dt
    week_ago = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=7)).isoformat()
    existing = supabase.table("job_change_alerts")\
        .select("id")\
        .eq("user_id", user_id)\
        .eq("lead_id", lead_id)\
        .gte("created_at", week_ago)\
        .limit(1)\
        .execute()
    if existing.data:
        return {"ok": True, "duplicate": True}

    row = {
        "user_id":      user_id,
        "lead_id":      lead_id,
        "old_title":    payload.get("old_title"),
        "old_company":  payload.get("old_company"),
        "new_title":    payload.get("new_title"),
        "new_company":  payload.get("new_company"),
        "detected_via": payload.get("detected_via", "extension"),
    }
    res = supabase.table("job_change_alerts").insert(row).execute()
    # Fire webhook
    try:
        _fire_webhooks(user_id, "lead.job_changed", {"lead_id": lead_id, **row})
    except Exception:
        pass
    return {"ok": True, "alert": res.data[0] if res.data else row}


@router.patch("/job-change-alerts/mark-seen")
async def mark_all_alerts_seen(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("job_change_alerts").update({"seen": True}).eq("user_id", user_id).eq("seen", False).execute()
    return {"ok": True}


@router.delete("/job-change-alerts/{alert_id}")
async def dismiss_alert(alert_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(alert_id)
    supabase.table("job_change_alerts").delete().eq("id", alert_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ─── UNSUBSCRIBE (public — no auth) ──────────────────────────────────────────

@router.get("/unsubscribe")
async def handle_unsubscribe(token: str = None, uid: str = None, email: str = None):
    """One-click unsubscribe link from sequence emails."""
    import urllib.parse as _up
    if not uid or not email:
        return Response(content="<html><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Invalid unsubscribe link.</h2></body></html>", media_type="text/html")
    email_decoded = _up.unquote(email)
    try:
        supabase.table("unsubscribes").upsert({"user_id": uid, "email": email_decoded}, on_conflict="user_id,email").execute()
        # Pause any active enrollments for this email
        lead_res = supabase.table("leads").select("id").eq("email", email_decoded).execute()
        lead_ids = [r["id"] for r in (lead_res.data or [])]
        for lid in lead_ids:
            supabase.table("sequence_enrollments").update({"status": "unsubscribed"}).eq("lead_id", lid).eq("user_id", uid).eq("status", "active").execute()
    except Exception:
        pass
    html = """<html><body style='font-family:sans-serif;text-align:center;padding:80px;background:#0a0a0a;color:#e5e5e5'>
<h2 style='font-weight:400'>You've been unsubscribed.</h2>
<p style='color:#888;font-size:14px'>You won't receive any more emails from this sender via Sonar.</p>
</body></html>"""
    return Response(content=html, media_type="text/html")


# ─── UNSUBSCRIBES CRUD ───────────────────────────────────────────────────────

@router.get("/unsubscribes")
async def list_unsubscribes(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        res = supabase.table("unsubscribes").select("*")\
            .eq("user_id", user_id).order("unsubscribed_at", desc=True).execute()
        return {"unsubscribes": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unsubscribes")
async def add_unsubscribe(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    email = (payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    try:
        supabase.table("unsubscribes").upsert(
            {"user_id": user_id, "email": email}, on_conflict="user_id,email"
        ).execute()
        # Pause any active enrollments for this email
        lead_res = supabase.table("leads").select("id")\
            .eq("user_id", user_id).ilike("email", email).execute()
        for row in (lead_res.data or []):
            supabase.table("sequence_enrollments").update({"status": "unsubscribed"})\
                .eq("lead_id", row["id"]).eq("user_id", user_id)\
                .eq("status", "active").execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/unsubscribes/{unsub_id}")
async def remove_unsubscribe(unsub_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(unsub_id, "unsub_id")
    try:
        supabase.table("unsubscribes").delete()\
            .eq("id", unsub_id).eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/unsubscribes")
async def clear_unsubscribes(authorization: str = Header(...)):
    """Remove all suppressions for this user."""
    user_id = get_user_id(authorization)
    try:
        supabase.table("unsubscribes").delete().eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── LEAD SEGMENTS ───────────────────────────────────────────────────────────

@router.get("/segments")
async def list_segments(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        res = supabase.table("lead_segments").select("*")\
            .eq("user_id", user_id).order("created_at", desc=False).execute()
        return {"segments": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/segments")
async def create_segment(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    filters = payload.get("filters") or {}
    try:
        res = supabase.table("lead_segments").insert(
            {"user_id": user_id, "name": name, "filters": filters}
        ).execute()
        return {"segment": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/segments/{seg_id}")
async def update_segment(seg_id: str, payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(seg_id, "seg_id")
    update = {}
    if "name" in payload: update["name"] = (payload["name"] or "").strip()
    if "filters" in payload: update["filters"] = payload["filters"]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    try:
        res = supabase.table("lead_segments").update(update)\
            .eq("id", seg_id).eq("user_id", user_id).execute()
        return {"segment": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/segments/{seg_id}")
async def delete_segment(seg_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(seg_id, "seg_id")
    try:
        supabase.table("lead_segments").delete()\
            .eq("id", seg_id).eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── SEQUENCE ANALYTICS ──────────────────────────────────────────────────────

@router.get("/sequences/{seq_id}/analytics")
async def get_sequence_analytics(seq_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(seq_id)

    # Enrollment counts by status
    enr_res = supabase.table("sequence_enrollments").select("id, status, current_step").eq("sequence_id", seq_id).eq("user_id", user_id).execute()
    enrollments = enr_res.data or []
    total      = len(enrollments)
    active     = sum(1 for e in enrollments if e["status"] == "active")
    completed  = sum(1 for e in enrollments if e["status"] == "completed")
    bounced    = sum(1 for e in enrollments if e["status"] == "bounced")
    replied    = sum(1 for e in enrollments if e["status"] == "replied" or e.get("replied_at"))
    unsubbed   = sum(1 for e in enrollments if e["status"] == "unsubscribed")

    # Email tracking aggregates for this sequence (include ab_variant)
    tracking_res = supabase.table("email_tracking").select("open_count, click_count, step_number, ab_variant").eq("sequence_id", seq_id).execute()
    tracking = tracking_res.data or []
    emails_sent   = len(tracking)
    unique_opens  = sum(1 for r in tracking if (r.get("open_count") or 0) > 0)
    unique_clicks = sum(1 for r in tracking if (r.get("click_count") or 0) > 0)

    open_rate   = round(unique_opens  / emails_sent * 100) if emails_sent else 0
    click_rate  = round(unique_clicks / emails_sent * 100) if emails_sent else 0
    reply_rate  = round(replied / total * 100) if total else 0
    bounce_rate = round(bounced / total * 100) if total else 0

    def _variant_stats(rows):
        sent   = len(rows)
        opens  = sum(1 for r in rows if (r.get("open_count") or 0) > 0)
        clicks = sum(1 for r in rows if (r.get("click_count") or 0) > 0)
        return {"sent": sent, "opens": opens, "clicks": clicks,
                "open_rate": round(opens / sent * 100) if sent else 0,
                "click_rate": round(clicks / sent * 100) if sent else 0}

    # Per-step breakdown with A/B split
    steps_res = supabase.table("sequence_steps").select("step_number, type, subject, subject_b").eq("sequence_id", seq_id).order("step_number").execute()
    steps = steps_res.data or []
    step_stats = []
    for step in steps:
        sn = step["step_number"]
        step_tracking = [t for t in tracking if t.get("step_number") == sn]
        base = _variant_stats(step_tracking)
        stat = {
            "step_number": sn,
            "type":        step["type"],
            "subject":     step.get("subject") or "",
            "subject_b":   step.get("subject_b") or None,
            **base,
        }
        # A/B split only when both variants have data
        if step.get("subject_b"):
            rows_a = [t for t in step_tracking if (t.get("ab_variant") or "A") == "A"]
            rows_b = [t for t in step_tracking if t.get("ab_variant") == "B"]
            if rows_a or rows_b:
                stat["ab"] = {"A": _variant_stats(rows_a), "B": _variant_stats(rows_b)}
        step_stats.append(stat)

    return {
        "total_enrolled": total,
        "active": active,
        "completed": completed,
        "bounced": bounced,
        "replied": replied,
        "unsubscribed": unsubbed,
        "emails_sent": emails_sent,
        "unique_opens": unique_opens,
        "unique_clicks": unique_clicks,
        "open_rate": open_rate,
        "click_rate": click_rate,
        "reply_rate": reply_rate,
        "bounce_rate": bounce_rate,
        "steps": step_stats,
    }


@router.patch("/sequences/{seq_id}/enrollments/{enrollment_id}/reply")
async def mark_enrollment_replied(seq_id: str, enrollment_id: str, authorization: str = Header(...)):
    """Manually mark a lead as having replied — pauses further steps."""
    import datetime as _dt
    user_id = get_user_id(authorization)
    validate_uuid(enrollment_id)
    now = _dt.datetime.now(_dt.timezone.utc).isoformat()
    enroll = _first(supabase.table("sequence_enrollments").select("lead_id, sequence_id").eq("id", enrollment_id).eq("user_id", user_id).limit(1).execute())
    supabase.table("sequence_enrollments").update({
        "status": "replied", "replied_at": now
    }).eq("id", enrollment_id).eq("user_id", user_id).execute()
    if enroll:
        lead = _first(supabase.table("leads").select("name, email, company").eq("id", enroll["lead_id"]).limit(1).execute())
        _fire_webhooks(user_id, "sequence.replied", {
            "enrollment_id": enrollment_id,
            "sequence_id": enroll.get("sequence_id"),
            "lead": lead or {},
        })
    return {"ok": True}


# ─── PROFILE SMTP CONFIG ──────────────────────────────────────────────────────

@router.get("/profile/smtp-config")
async def get_smtp_config(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = _first(supabase.table("profiles").select("smtp_config").eq("id", user_id).limit(1).execute()) or {}
    config = res.get("smtp_config") or {}
    # Mask password before returning
    masked = {**config}
    if masked.get("smtp_pass"):
        masked["smtp_pass"] = "••••••••"
    return {"smtp_config": masked, "configured": bool(config.get("smtp_user") and config.get("smtp_pass"))}


@router.patch("/profile/smtp-config")
async def save_smtp_config(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    allowed_keys = {"smtp_host", "smtp_port", "smtp_user", "smtp_pass", "from_email", "from_name"}
    config = {k: v for k, v in payload.items() if k in allowed_keys}
    # If password is masked placeholder, keep existing
    if config.get("smtp_pass") == "••••••••":
        existing_res = _first(supabase.table("profiles").select("smtp_config").eq("id", user_id).limit(1).execute()) or {}
        existing = existing_res.get("smtp_config") or {}
        config["smtp_pass"] = existing.get("smtp_pass", "")
    supabase.table("profiles").update({"smtp_config": config}).eq("id", user_id).execute()
    return {"ok": True}


@router.delete("/profile/smtp-config")
async def delete_smtp_config(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("profiles").update({"smtp_config": None}).eq("id", user_id).execute()
    return {"ok": True}


# ─── ENRICHMENT CONFIG ───────────────────────────────────────────────────────

@router.get("/profile/enrichment-config")
async def get_enrichment_config(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res  = _first(supabase.table("profiles").select("enrichment_config").eq("id", user_id).limit(1).execute()) or {}
    cfg  = res.get("enrichment_config") or {}
    # Mask keys — return placeholder if set
    return {
        "hunter_key_set":  bool(cfg.get("hunter_key") or os.getenv("HUNTER_API_KEY")),
        "apollo_key_set":  bool(cfg.get("apollo_key") or os.getenv("APOLLO_API_KEY")),
        "hunter_key":      "••••••••" if cfg.get("hunter_key") else "",
        "apollo_key":      "••••••••" if cfg.get("apollo_key") else "",
        "waterfall_order": cfg.get("waterfall_order", ["hunter", "apollo", "pattern"]),
    }


@router.patch("/profile/enrichment-config")
async def save_enrichment_config(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res  = _first(supabase.table("profiles").select("enrichment_config").eq("id", user_id).limit(1).execute()) or {}
    existing = res.get("enrichment_config") or {}
    updated  = dict(existing)
    # Only overwrite keys that are explicitly provided (don't wipe with masked value)
    for k in ("hunter_key", "apollo_key"):
        val = (payload.get(k) or "").strip()
        if val and val != "••••••••":
            updated[k] = val
    if "waterfall_order" in payload:
        updated["waterfall_order"] = payload["waterfall_order"]
    supabase.table("profiles").update({"enrichment_config": updated}).eq("id", user_id).execute()
    return {"ok": True}


@router.delete("/profile/enrichment-config")
async def delete_enrichment_config(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("profiles").update({"enrichment_config": {}}).eq("id", user_id).execute()
    return {"ok": True}


# ─── DASHBOARD SUMMARY ───────────────────────────────────────────────────────

@router.get("/dashboard/summary")
async def dashboard_summary(authorization: str = Header(...)):
    import datetime as _dt
    user_id = get_user_id(authorization)
    now     = _dt.datetime.now(_dt.timezone.utc)
    week_ago       = (now - _dt.timedelta(days=7)).isoformat()
    two_weeks_ago  = (now - _dt.timedelta(days=14)).isoformat()
    today_end      = now.replace(hour=23, minute=59, second=59).isoformat()

    leads_res      = supabase.table("leads").select("id,status,icp_score,created_at").eq("user_id", user_id).execute()
    leads          = leads_res.data or []
    companies_res  = supabase.table("companies").select("id,created_at").eq("user_id", user_id).execute()
    companies      = companies_res.data or []
    seq_res        = supabase.table("sequences").select("id,name,status").eq("user_id", user_id).execute()
    sequences      = seq_res.data or []
    enr_res        = supabase.table("sequence_enrollments").select("id,status").eq("user_id", user_id).execute()
    enrollments    = enr_res.data or []
    tracking_res   = supabase.table("email_tracking").select("open_count,click_count").eq("user_id", user_id).execute()
    tracking       = tracking_res.data or []
    tasks_res      = supabase.table("tasks").select("id,title,due_date,completed,priority,leads(name,company)").eq("user_id", user_id).eq("completed", False).lte("due_date", today_end).order("due_date").limit(8).execute()
    activity_res   = supabase.table("lead_activity").select("id,event_type,data,created_at,leads(name,company)").eq("user_id", user_id).order("created_at", desc=True).limit(15).execute()
    replies_res    = supabase.table("sequence_enrollments").select("id,replied_at,lead_id,sequence_id,reply_sentiment,leads(id,name,email,company,title),sequences(name)").eq("user_id", user_id).eq("status", "replied").order("replied_at", desc=True).limit(10).execute()

    emails_sent    = len(tracking)
    unique_opens   = sum(1 for t in tracking if (t.get("open_count") or 0) > 0)
    unique_clicks  = sum(1 for t in tracking if (t.get("click_count") or 0) > 0)
    scored_leads   = [l for l in leads if l.get("icp_score") is not None]

    return {
        "leads": {
            "total":       len(leads),
            "new":         sum(1 for l in leads if l.get("status") == "new"),
            "contacted":   sum(1 for l in leads if l.get("status") == "contacted"),
            "qualified":   sum(1 for l in leads if l.get("status") == "qualified"),
            "this_week":   sum(1 for l in leads if (l.get("created_at") or "") >= week_ago),
            "last_week":   sum(1 for l in leads if two_weeks_ago <= (l.get("created_at") or "") < week_ago),
            "avg_score":   round(sum(l["icp_score"] for l in scored_leads) / len(scored_leads)) if scored_leads else None,
        },
        "companies": {"total": len(companies)},
        "sequences": {
            "total":              len(sequences),
            "active":             sum(1 for s in sequences if s.get("status") == "active"),
            "active_enrollments": sum(1 for e in enrollments if e.get("status") == "active"),
            "completed":          sum(1 for e in enrollments if e.get("status") == "completed"),
            "bounced":            sum(1 for e in enrollments if e.get("status") == "bounced"),
            "replied":            sum(1 for e in enrollments if e.get("status") == "replied"),
            "emails_sent":        emails_sent,
            "unique_opens":       unique_opens,
            "unique_clicks":      unique_clicks,
            "avg_open_rate":      round(unique_opens / emails_sent * 100) if emails_sent else 0,
            "avg_click_rate":     round(unique_clicks / emails_sent * 100) if emails_sent else 0,
        },
        "tasks_due_today":  tasks_res.data or [],
        "recent_activity":  activity_res.data or [],
        "recent_replies":   replies_res.data or [],
    }


# ─── EMAIL VERIFICATION ───────────────────────────────────────────────────────

@router.post("/leads/{lead_id}/verify-email")
async def verify_lead_email(lead_id: str, authorization: str = Header(...)):
    """Verify lead email deliverability — full pipeline (MX, disposable, catch-all, SMTP)."""
    user_id = get_user_id(authorization)
    validate_uuid(lead_id)
    lead     = _first(supabase.table("leads").select("email").eq("id", lead_id).eq("user_id", user_id).limit(1).execute()) or {}
    email    = lead.get("email")
    if not email:
        raise HTTPException(status_code=422, detail="Lead has no email address")
    try:
        from .email_verifier import verify_email, status_to_db
        result = verify_email(email)
        supabase.table("leads").update(status_to_db(result)).eq("id", lead_id).execute()
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/leads/bulk-verify")
async def bulk_verify_leads(payload: dict, authorization: str = Header(...)):
    """Verify emails for a batch of leads. Returns per-lead results."""
    user_id  = get_user_id(authorization)
    lead_ids = payload.get("lead_ids") or []
    if not lead_ids:
        raise HTTPException(status_code=422, detail="lead_ids required")
    if len(lead_ids) > 200:
        raise HTTPException(status_code=422, detail="Maximum 200 leads per bulk verify call")

    from .email_verifier import verify_email, status_to_db

    res = supabase.table("leads")\
        .select("id,email")\
        .in_("id", lead_ids)\
        .eq("user_id", user_id)\
        .execute()
    leads = res.data or []

    results   = []
    verified  = 0
    skipped   = 0
    errors    = 0

    for lead in leads:
        lid   = lead["id"]
        email = (lead.get("email") or "").strip()
        if not email:
            results.append({"lead_id": lid, "email": None, "status": "skipped", "score": None, "reason": "No email"})
            skipped += 1
            continue
        try:
            r = verify_email(email)
            supabase.table("leads").update(status_to_db(r)).eq("id", lid).execute()
            results.append({"lead_id": lid, **r})
            verified += 1
        except Exception as ex:
            results.append({"lead_id": lid, "email": email, "status": "error", "score": None, "reason": str(ex)})
            errors += 1

    summary = {
        "total":    len(leads),
        "verified": verified,
        "skipped":  skipped,
        "errors":   errors,
        "valid":    sum(1 for r in results if r.get("status") == "valid"),
        "risky":    sum(1 for r in results if r.get("status") in ("risky", "unknown", "catch_all")),
        "invalid":  sum(1 for r in results if r.get("status") in ("invalid", "disposable")),
        "role":     sum(1 for r in results if r.get("status") == "role"),
    }
    return {"summary": summary, "results": results}


@router.get("/leads/unverified-count")
async def unverified_email_count(authorization: str = Header(...)):
    """Count leads that have an email but haven't been verified yet."""
    user_id = get_user_id(authorization)
    res = supabase.table("leads")\
        .select("id", count="exact")\
        .eq("user_id", user_id)\
        .not_.is_("email", "null")\
        .is_("email_status", "null")\
        .execute()
    return {"count": res.count or 0}


# ─── DOMAIN HEALTH CHECK ─────────────────────────────────────────────────────

@router.get("/profile/domain-health")
async def check_domain_health(domain: str, authorization: str = Header(...)):
    """Check SPF and DMARC DNS records for a sending domain."""
    get_user_id(authorization)
    import re as _re2
    domain = domain.strip().lower().lstrip("@")
    if not domain or not _re2.match(r'^[a-z0-9][a-z0-9\-\.]+\.[a-z]{2,}$', domain):
        raise HTTPException(status_code=422, detail="Invalid domain")

    import urllib.request as _urlreq, json as _jlib

    def _dns_txt(name: str) -> list[str]:
        """Fetch TXT records via Google DoH."""
        try:
            url = f"https://dns.google/resolve?name={name}&type=TXT"
            with _urlreq.urlopen(url, timeout=5) as r:
                data = _jlib.loads(r.read())
            return [
                "".join(x.get("data", "").strip('"') for x in (ans.get("data") or [{}] if isinstance(ans.get("data"), list) else [{"data": ans.get("data", "")}]))
                for ans in (data.get("Answer") or [])
                if ans.get("type") == 16
            ]
        except Exception:
            return []

    spf_records  = [r for r in _dns_txt(domain) if r.startswith("v=spf1")]
    dmarc_records = [r for r in _dns_txt(f"_dmarc.{domain}") if r.startswith("v=DMARC1")]

    spf_ok     = len(spf_records) > 0
    dmarc_ok   = len(dmarc_records) > 0
    spf_val    = spf_records[0] if spf_records else None
    dmarc_val  = dmarc_records[0] if dmarc_records else None

    # Warn if SPF is too permissive (+all) or if DMARC is set to none
    spf_warn   = spf_ok and "+all" in (spf_val or "")
    dmarc_none = dmarc_ok and "p=none" in (dmarc_val or "")

    score = (40 if spf_ok else 0) + (40 if dmarc_ok else 0) + (20 if not spf_warn and not dmarc_none else 0)

    return {
        "domain":  domain,
        "score":   score,
        "spf":     {"ok": spf_ok, "value": spf_val, "warn": spf_warn},
        "dmarc":   {"ok": dmarc_ok, "value": dmarc_val, "warn": dmarc_none},
        "recommendations": [
            *( [] if spf_ok else ["Add an SPF record: v=spf1 include:_spf.google.com ~all"] ),
            *( ["Your SPF uses +all (allows any server) — switch to ~all or -all"] if spf_warn else [] ),
            *( [] if dmarc_ok else ["Add a DMARC record: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"] ),
            *( ["Your DMARC policy is p=none (monitor only) — upgrade to p=quarantine"] if dmarc_none else [] ),
        ],
    }


# ─── PHASE 1: ANALYTICS ──────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(authorization: str = Header(...)):
    user_id = get_user_id(authorization)

    leads_res = supabase.table("leads").select("id, icp_score, starred, connection_status, created_at").eq("user_id", user_id).execute()
    leads = leads_res.data or []

    companies_res = supabase.table("companies").select("id, prospect_status, created_at").eq("user_id", user_id).execute()
    companies = companies_res.data or []

    sequences_res = supabase.table("sequences").select("id, status, name").eq("user_id", user_id).execute()
    sequences = sequences_res.data or []

    total_enrolled = 0
    total_replied = 0
    for seq in sequences:
        enr = supabase.table("sequence_enrollments").select("id, status", count="exact").eq("sequence_id", seq["id"]).execute()
        seq["enrolled"] = enr.count or 0
        total_enrolled += seq["enrolled"]
        replied = supabase.table("sequence_enrollments").select("id", count="exact").eq("sequence_id", seq["id"]).eq("status", "replied").execute()
        seq["replied"] = replied.count or 0
        total_replied += seq["replied"]

    scored_leads = [l for l in leads if l.get("icp_score") is not None]
    avg_score = round(sum(l["icp_score"] for l in scored_leads) / len(scored_leads)) if scored_leads else 0
    high_value = len([l for l in scored_leads if l["icp_score"] >= 70])
    starred_count = len([l for l in leads if l.get("starred")])

    reply_rate = round((total_replied / total_enrolled * 100)) if total_enrolled > 0 else 0

    # Pipeline breakdown by status
    leads_full = supabase.table("leads").select("id, icp_score, starred, status, deal_value, expected_close_date, created_at").eq("user_id", user_id).execute().data or []
    pipeline_by_status = {
        "new":          len([l for l in leads_full if l.get("status") == "new"]),
        "contacted":    len([l for l in leads_full if l.get("status") == "contacted"]),
        "qualified":    len([l for l in leads_full if l.get("status") == "qualified"]),
        "disqualified": len([l for l in leads_full if l.get("status") == "disqualified"]),
    }
    # Deal value
    valued = [l for l in leads_full if l.get("deal_value")]
    total_pipeline_value = sum(float(l["deal_value"]) for l in valued)

    # ICP score distribution
    score_dist = {"high": 0, "medium": 0, "low": 0, "unscored": 0}
    for l in leads_full:
        s = l.get("icp_score")
        if s is None:          score_dist["unscored"] += 1
        elif s >= 70:          score_dist["high"] += 1
        elif s >= 40:          score_dist["medium"] += 1
        else:                  score_dist["low"] += 1

    # Email tracking stats
    et_res = supabase.table("email_tracking").select("tracking_id, open_count, first_opened_at, created_at, click_count").eq("user_id", user_id).execute().data or []
    emails_sent   = len(et_res)
    emails_opened = len([e for e in et_res if (e.get("open_count") or 0) > 0])
    open_rate     = round(emails_opened / emails_sent * 100) if emails_sent else 0
    total_clicks  = sum((e.get("click_count") or 0) for e in et_res)
    click_rate    = round(total_clicks / emails_sent * 100) if emails_sent else 0

    # Tasks stats
    import datetime as _dt
    today_str = _dt.date.today().isoformat()
    week_ago  = (_dt.date.today() - _dt.timedelta(days=7)).isoformat()
    tasks_res = supabase.table("tasks").select("id, completed, due_date, completed_at").eq("user_id", user_id).execute().data or []
    tasks_open      = len([t for t in tasks_res if not t.get("completed")])
    tasks_overdue   = len([t for t in tasks_res if not t.get("completed") and t.get("due_date") and t["due_date"] < today_str])
    tasks_done_week = len([t for t in tasks_res if t.get("completed") and t.get("completed_at") and t["completed_at"][:10] >= week_ago])

    # Activity heatmap — last 84 days (12 weeks)
    day_counts = {}
    for l in leads_full:
        d = (l.get("created_at") or "")[:10]
        if d:
            day_counts[d] = day_counts.get(d, 0) + 1
    for e in et_res:
        d = (e.get("created_at") or "")[:10]
        if d:
            day_counts[d] = day_counts.get(d, 0) + 1
    heatmap = []
    for i in range(83, -1, -1):
        day = (_dt.date.today() - _dt.timedelta(days=i)).isoformat()
        heatmap.append({"date": day, "count": day_counts.get(day, 0)})

    # Weekly lead trend — last 8 weeks
    weekly_trend = []
    for w in range(7, -1, -1):
        week_start = (_dt.date.today() - _dt.timedelta(days=_dt.date.today().weekday() + 7 * w)).isoformat()
        week_end   = (_dt.date.today() - _dt.timedelta(days=_dt.date.today().weekday() + 7 * w - 6)).isoformat()
        count = len([l for l in leads_full if week_start <= (l.get("created_at") or "")[:10] <= week_end])
        weekly_trend.append({"week_start": week_start, "count": count})

    # Sequence per-step funnel
    for seq in sequences:
        seq_steps_res = supabase.table("sequence_steps").select("id, step_number, type").eq("sequence_id", seq["id"]).order("step_number").execute().data or []
        step_funnel = []
        for step in seq_steps_res:
            sent = supabase.table("email_tracking").select("id", count="exact")\
                .eq("user_id", user_id).eq("sequence_id", seq["id"])\
                .eq("step_number", step["step_number"]).execute().count or 0
            opened = supabase.table("email_tracking").select("id", count="exact")\
                .eq("user_id", user_id).eq("sequence_id", seq["id"])\
                .eq("step_number", step["step_number"]).gt("open_count", 0).execute().count or 0
            step_funnel.append({
                "step_number": step["step_number"],
                "type": step["type"],
                "sent": sent,
                "opened": opened,
                "open_rate": round(opened / sent * 100) if sent else 0,
            })
        seq["step_funnel"] = step_funnel

    return {
        "leads": {
            "total": len(leads),
            "scored": len(scored_leads),
            "avg_score": avg_score,
            "high_value": high_value,
            "starred": starred_count,
            "by_status": pipeline_by_status,
            "score_distribution": score_dist,
            "weekly_trend": weekly_trend,
        },
        "companies": {
            "total": len(companies),
        },
        "sequences": {
            "total": len(sequences),
            "active": len([s for s in sequences if s["status"] == "active"]),
            "total_enrolled": total_enrolled,
            "total_replied": total_replied,
            "reply_rate": reply_rate,
            "list": sequences,
        },
        "email": {
            "sent": emails_sent,
            "opened": emails_opened,
            "open_rate": open_rate,
            "total_clicks": total_clicks,
            "click_rate": click_rate,
        },
        "tasks": {
            "open": tasks_open,
            "overdue": tasks_overdue,
            "completed_this_week": tasks_done_week,
        },
        "pipeline": {
            "by_status": pipeline_by_status,
            "total_value": total_pipeline_value,
            "valued_deals": len(valued),
        },
        "activity_heatmap": heatmap,
    }


# ═══════════════════════════════════════════════════════════════════
# CSV IMPORT / EXPORT
# ═══════════════════════════════════════════════════════════════════

import csv as _csv
import io as _io

_CSV_FIELD_MAP = {
    'name':         ['name', 'full name', 'fullname', 'contact name', 'contact'],
    'email':        ['email', 'email address', 'work email', 'business email'],
    'company':      ['company', 'company name', 'organization', 'employer', 'account'],
    'title':        ['title', 'job title', 'position', 'role', 'designation'],
    'phone':        ['phone', 'phone number', 'mobile', 'tel', 'telephone'],
    'linkedin_url': ['linkedin', 'linkedin url', 'linkedin profile', 'profile url'],
    'location':     ['location', 'city', 'country', 'region'],
    'status':       ['status', 'lead status', 'stage'],
    'notes':        ['notes', 'note', 'comments', 'description'],
}
_VALID_STATUSES = {'new', 'contacted', 'qualified', 'disqualified'}


@router.post("/leads/import-csv")
async def import_leads_csv(request: Request, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    body    = await request.body()
    content = body.decode('utf-8-sig')

    reader  = _csv.DictReader(_io.StringIO(content))
    created = skipped = 0

    for row in reader:
        mapped: dict = {}
        for raw_key, val in row.items():
            k = raw_key.lower().strip()
            for field, aliases in _CSV_FIELD_MAP.items():
                if k in aliases:
                    mapped[field] = (val or '').strip()
                    break

        if not mapped.get('name') and not mapped.get('email'):
            skipped += 1
            continue

        if mapped.get('email'):
            dup = supabase.table("leads").select("id") \
                .eq("user_id", user_id).eq("email", mapped['email']).execute()
            if dup.data:
                skipped += 1
                continue

        if mapped.get('status') not in _VALID_STATUSES:
            mapped['status'] = 'new'

        supabase.table("leads").insert({
            **{k: v for k, v in mapped.items() if v},
            "user_id": user_id,
            "source":  "csv_import",
        }).execute()
        created += 1

    return {"created": created, "skipped": skipped}


@router.get("/leads/export-csv")
async def export_leads_csv(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    leads   = supabase.table("leads").select(
        "name, email, email_status, email_score, title, company, phone, location, linkedin_url, status, connection_status, icp_score, deal_value, notes, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).execute().data or []

    fields  = ["name", "email", "email_status", "email_score", "title", "company", "phone", "location",
                "linkedin_url", "status", "connection_status", "icp_score",
                "deal_value", "notes", "created_at"]
    out     = _io.StringIO()
    writer  = _csv.DictWriter(out, fieldnames=fields, extrasaction='ignore')
    writer.writeheader()
    for lead in leads:
        writer.writerow({f: (lead.get(f) or '') for f in fields})

    return Response(
        content=out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sonar-leads.csv"'},
    )


# ═══════════════════════════════════════════════════════════════════
# LINKEDIN ENRICHMENT VIA PROXYCURL
# ═══════════════════════════════════════════════════════════════════

_PROXYCURL_KEY = os.environ.get("PROXYCURL_API_KEY", "")


@router.post("/leads/{lead_id}/enrich-linkedin")
async def enrich_lead_linkedin(lead_id: str, authorization: str = Header(...)):
    validate_uuid(lead_id)
    user_id = get_user_id(authorization)

    if not _PROXYCURL_KEY:
        raise HTTPException(status_code=503, detail="LinkedIn enrichment not configured on this server.")

    lead = _first(supabase.table("leads").select("*") \
        .eq("id", lead_id).eq("user_id", user_id).limit(1).execute())
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    li_url = lead.get("linkedin_url") or lead.get("profile_url")
    if not li_url:
        raise HTTPException(status_code=400, detail="No LinkedIn URL on this lead")

    try:
        res  = requests.get(
            "https://nubela.co/proxycurl/api/v2/linkedin",
            params={"url": li_url, "use_cache": "if-present", "fallback_to_cache": "on-error"},
            headers={"Authorization": f"Bearer {_PROXYCURL_KEY}"},
            timeout=20,
        )
        data = res.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxycurl error: {e}")

    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=data.get("description", "Proxycurl failed"))

    upd: dict = {}
    if not lead.get("name")     and data.get("full_name"):   upd["name"]  = data["full_name"]
    if not lead.get("location") and data.get("city"):
        upd["location"] = ", ".join(p for p in [data.get("city"), data.get("country_full_name")] if p)
    if not lead.get("about")    and data.get("summary"):     upd["about"] = data["summary"]

    experiences = data.get("experiences") or []
    current = next((e for e in experiences if not e.get("ends_at")), None)
    if current:
        if not lead.get("company") and current.get("company"): upd["company"] = current["company"]
        if not lead.get("title")   and current.get("title"):   upd["title"]   = current["title"]

    if upd:
        supabase.table("leads").update(upd).eq("id", lead_id).execute()

    supabase.table("lead_activity").insert({
        "lead_id": lead_id, "user_id": user_id,
        "event_type": "enriched",
        "data": {"source": "proxycurl", "fields_updated": list(upd.keys())},
    }).execute()

    return {"updated": upd}


# ═══════════════════════════════════════════════════════════════════
# SMTP EMAIL SENDING
# ═══════════════════════════════════════════════════════════════════

import smtplib as _smtplib
from email.mime.text      import MIMEText      as _MIMEText
from email.mime.multipart import MIMEMultipart as _MIMEMultipart


@router.post("/leads/{lead_id}/send-email")
async def send_lead_email(lead_id: str, payload: dict, authorization: str = Header(...)):
    validate_uuid(lead_id)
    user_id = get_user_id(authorization)

    lead = _first(supabase.table("leads").select("email, name").eq("id", lead_id).eq("user_id", user_id).limit(1).execute())
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    to_email = lead.get("email")
    if not to_email:
        raise HTTPException(status_code=400, detail="Lead has no email address")

    subject    = payload.get("subject", "(no subject)")
    body       = payload.get("body", "")
    smtp_host  = payload.get("smtp_host", "smtp.gmail.com")
    smtp_port  = int(payload.get("smtp_port", 587))
    smtp_user  = payload.get("smtp_user", "")
    smtp_pass  = payload.get("smtp_pass", "")
    from_name  = payload.get("from_name", "")
    from_email = payload.get("from_email") or smtp_user

    if not smtp_user or not smtp_pass:
        raise HTTPException(status_code=400, detail="SMTP credentials not configured. Add them in Settings → Email Sending.")

    try:
        msg              = _MIMEMultipart("alternative")
        msg["Subject"]   = subject
        msg["From"]      = f"{from_name} <{from_email}>" if from_name else from_email
        msg["To"]        = to_email
        msg.attach(_MIMEText(body, "plain"))

        with _smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(from_email, to_email, msg.as_string())
    except _smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="SMTP login failed. For Gmail use an App Password, not your main password.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Send failed: {e}")

    supabase.table("lead_activity").insert({
        "lead_id": lead_id, "user_id": user_id,
        "event_type": "email_sent",
        "data": {"subject": subject, "to": to_email, "via": "smtp"},
    }).execute()

    return {"sent": True, "to": to_email}


# ─── PROSPECT SEARCH (People Data Labs — 800M+ profiles) ──────────────────────
# ─── LIVE ENRICHMENT (Firecrawl — LinkedIn scrape + proprietary email finder) ─

from app.enrichment import (
    extract_domain as _extract_domain,
    waterfall_find_email_v2 as _find_email,
    scrape_linkedin_profile as _scrape_linkedin,
    find_linkedin_url as _find_linkedin_url,
    find_domain_contacts as _find_domain_contacts,
    waterfall_find_email as _waterfall_find_email,
)


@router.post("/prospect/enrich-live")
async def prospect_enrich_live(payload: dict, authorization: str = Header(...)):
    """
    Enrich a PDL prospect with live data.
    1. Scrape their LinkedIn public profile via Firecrawl (no user credentials).
    2. Find their work email via proprietary pipeline (web search → site scrape → SMTP).
    3. Merge live data over PDL data and return.
    """
    get_user_id(authorization)
    person = payload.get("person", {})

    # ── Resolve names ────────────────────────────────────────────────────────────
    fn = (person.get("first_name") or "").strip()
    ln = (person.get("last_name") or "").strip()
    if not fn and person.get("full_name"):
        parts = (person.get("full_name") or "").split()
        fn = parts[0] if parts else ""
        ln = " ".join(parts[1:]) if len(parts) > 1 else ""

    # ── Resolve LinkedIn URL ─────────────────────────────────────────────────────
    li_url = (person.get("linkedin_url") or "").strip()
    if li_url and not li_url.startswith("http"):
        li_url = "https://linkedin.com/in/" + li_url
    if not li_url and fn and ln:
        company = person.get("job_company_name") or ""
        li_url  = _find_linkedin_url(fn, ln, company)

    # ── Scrape LinkedIn public profile ───────────────────────────────────────────
    li_data: dict = {}
    if li_url:
        li_data = _scrape_linkedin(li_url)

    # ── Find work email ──────────────────────────────────────────────────────────
    raw_domain = (person.get("job_company_website") or "").strip()
    domain     = _extract_domain(raw_domain) if raw_domain else ""
    if not domain:
        company_name = (person.get("job_company_name") or "").lower().replace(" ", "")
        domain = f"{company_name}.com" if company_name else ""

    email_result: dict = {}
    existing_email = (person.get("work_email") or "").strip()
    if not existing_email and fn and ln and domain:
        email_result = _find_email(fn, ln, domain, person.get("job_company_name") or "")

    # ── Merge: live data wins, PDL as fallback ───────────────────────────────────
    enriched = {
        **person,
        "full_name":         li_data.get("full_name")        or person.get("full_name"),
        "job_title":         li_data.get("job_title")        or person.get("job_title"),
        "job_company_name":  li_data.get("job_company_name") or person.get("job_company_name"),
        "linkedin_url":      li_url                          or person.get("linkedin_url"),
        "profile_pic_url":   li_data.get("profile_pic_url")  or person.get("profile_pic_url"),
        "summary":           li_data.get("headline")         or person.get("summary"),
        "work_email":        email_result.get("email")       or existing_email or person.get("work_email"),
        "email_score":       email_result.get("email_score"),
        "email_provider":    email_result.get("email_provider"),
        "live_verified":     bool(li_data or email_result),
    }
    if not enriched.get("live_verified"):
        raise HTTPException(status_code=404, detail="Could not enrich — no LinkedIn URL and no email found")

    return {"person": enriched}


@router.post("/prospect/find-email")
async def prospect_find_email(payload: dict, authorization: str = Header(...)):
    """
    Standalone email finder — Hunter.io replacement.
    Input: {first_name, last_name, domain, company}
    Returns: {email, score, provider, patterns}
    """
    get_user_id(authorization)
    first   = (payload.get("first_name") or "").strip()
    last    = (payload.get("last_name")  or "").strip()
    domain  = (payload.get("domain")     or "").strip().lower()
    company = (payload.get("company")    or "").strip()

    if not first or not last or not domain:
        raise HTTPException(status_code=400, detail="first_name, last_name, and domain are required")

    result = _find_email(first, last, domain, company)

    from app.enrichment import _all_patterns
    patterns = _all_patterns(first, last, domain)

    return {
        "email":    result.get("email"),
        "score":    result.get("email_score", 0),
        "provider": result.get("email_provider"),
        "found":    bool(result.get("email")),
        "patterns": patterns[:6],
    }


@router.post("/prospect/domain-contacts")
async def prospect_domain_contacts(payload: dict, authorization: str = Header(...)):
    """
    Find all staff contacts at a company domain — Hunter domain search replacement.
    Input: {domain}
    Returns: {contacts: [{email}], total}
    """
    get_user_id(authorization)
    domain = (payload.get("domain") or "").strip().lower()
    if not domain or "." not in domain:
        raise HTTPException(status_code=400, detail="Valid domain required (e.g. stripe.com)")

    contacts = _find_domain_contacts(domain)
    return {"contacts": contacts, "total": len(contacts), "domain": domain}



_PDL_KEY  = os.environ.get("PDL_API_KEY", "")
_PDL_BASE = "https://api.peopledatalabs.com/v5"

import hashlib as _hashlib
import json as _json
import time as _time

_PDL_CACHE_TTL = 3600  # 1 hour

# Nested cache: query_key → {page: {result, scroll_token, ts}}
# scroll_token from page N is used to fetch page N+1
_pdl_scroll_cache: dict = {}

def _pdl_query_key(payload: dict) -> str:
    blob = _json.dumps(
        {k: payload.get(k) for k in ("keywords", "titles", "companies", "locations", "sizes")},
        sort_keys=True,
    )
    return _hashlib.md5(blob.encode()).hexdigest()

def _build_pdl_sql(payload: dict) -> str:
    titles    = [t.strip() for t in (payload.get("titles") or []) if t.strip()]
    companies = [c.strip() for c in (payload.get("companies") or []) if c.strip()]
    locations = [l.strip() for l in (payload.get("locations") or []) if l.strip()]
    sizes     = payload.get("sizes") or []
    keywords  = (payload.get("keywords") or "").strip()

    def esc(s: str) -> str:
        return s.replace("'", "''")

    clauses: list[str] = []

    if keywords:
        kw = esc(keywords.lower())
        # keywords searches title only to avoid flooding results with off-topic companies/industries
        clauses.append(f"(job_title LIKE '%{kw}%')")
    if titles:
        parts = " OR ".join(f"job_title LIKE '%{esc(t.lower())}%'" for t in titles)
        clauses.append(f"({parts})")
    if companies:
        # PDL normalises company names to lowercase; use both exact and LIKE for reliability
        parts = " OR ".join(
            f"(job_company_name='{esc(c.lower())}' OR job_company_name LIKE '%{esc(c.lower())}%')"
            for c in companies
        )
        clauses.append(f"({parts})")
    if locations:
        loc_parts: list[str] = []
        for loc in locations:
            el = esc(loc.lower())
            loc_parts += [
                f"location_country='{el}'",
                f"location_locality='{el}'",
                f"location_region='{el}'",
            ]
        clauses.append(f"({'  OR '.join(loc_parts)})")
    if sizes:
        parts = " OR ".join(f"job_company_size='{esc(s)}'" for s in sizes)
        clauses.append(f"({parts})")

    where = " AND ".join(clauses) if clauses else "full_name IS NOT NULL"
    sql = f"SELECT * FROM person WHERE {where}"
    print(f"[PDL] companies={companies!r} sizes={sizes!r} titles={titles!r} sql={sql!r}")
    return sql

@router.post("/prospect/people-search")
async def prospect_people_search(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _check_user_rate_limit(user_id, "people-search", limit=30, window_minutes=60)
    if not _PDL_KEY:
        raise HTTPException(status_code=503, detail="Prospect search not configured — add PDL_API_KEY to Vercel env vars.")

    page      = max(1, int(payload.get("page", 1)))
    per_page  = 10
    query_key = _pdl_query_key(payload)
    q_cache   = _pdl_scroll_cache.get(query_key, {})

    # Return cached result for this page if still fresh
    page_entry = q_cache.get(page)
    if page_entry and _time.time() - page_entry["ts"] < _PDL_CACHE_TTL:
        return {**page_entry["result"], "cached": True}

    # Need scroll_token from previous page to paginate
    scroll_token = None
    if page > 1:
        prev = q_cache.get(page - 1)
        if not prev or _time.time() - prev["ts"] >= _PDL_CACHE_TTL:
            raise HTTPException(status_code=400, detail="Session expired — please search again from page 1.")
        scroll_token = prev.get("scroll_token")
        if not scroll_token:
            raise HTTPException(status_code=400, detail="No more results available.")

    sql = _build_pdl_sql(payload)
    body = {
        "sql":    sql,
        "size":   per_page,
        "pretty": False,
    }
    if scroll_token:
        body["scroll_token"] = scroll_token

    try:
        res = requests.post(
            f"{_PDL_BASE}/person/search",
            json=body,
            headers={"X-Api-Key": _PDL_KEY, "Content-Type": "application/json"},
            timeout=20,
        )
        data = res.json()
        if res.status_code not in (200, 404):
            raise HTTPException(
                status_code=502,
                detail=data.get("error", {}).get("message") or "PDL search failed",
            )
        total        = data.get("total", 0)
        people       = data.get("data", [])
        new_scroll   = data.get("scroll_token")
        total_pages  = max(1, (total + per_page - 1) // per_page)
        result = {
            "people":      people,
            "total":       total,
            "page":        page,
            "total_pages": min(total_pages, 40),
            "has_more":    bool(new_scroll and len(people) == per_page),
            "cached":      False,
        }
        # Cache result + scroll_token for next page
        if query_key not in _pdl_scroll_cache:
            _pdl_scroll_cache[query_key] = {}
        _pdl_scroll_cache[query_key][page] = {
            "result":       result,
            "scroll_token": new_scroll,
            "ts":           _time.time(),
        }
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post("/prospect/reveal-email")
async def prospect_reveal_email(payload: dict, authorization: str = Header(...)):
    get_user_id(authorization)
    if not _PDL_KEY:
        raise HTTPException(status_code=503, detail="Not configured")
    linkedin_url = payload.get("linkedin_url") or ""
    person_id    = payload.get("person_id") or ""
    if not linkedin_url and not person_id:
        raise HTTPException(status_code=400, detail="linkedin_url or person_id required")
    params: dict = {"pretty": False}
    if linkedin_url: params["profile"] = linkedin_url
    elif person_id:  params["id"]      = person_id
    try:
        res = requests.get(
            f"{_PDL_BASE}/person/enrich",
            params=params,
            headers={"X-Api-Key": _PDL_KEY},
            timeout=15,
        )
        data = res.json()
        person = data.get("data") or data
        email  = person.get("work_email") or (person.get("emails") or [{}])[0].get("address")
        phone  = (person.get("phone_numbers") or [None])[0]
        return {"email": email, "phone": phone}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post("/prospect/add-lead")
async def prospect_add_lead(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    p = payload.get("person", {})
    # PDL field names
    name = p.get("full_name") or f"{p.get('first_name','') or ''} {p.get('last_name','') or ''}".strip()
    location_parts = [x for x in [p.get("location_locality"), p.get("location_region"), p.get("location_country")] if x]
    location = ", ".join(location_parts[:2]) if location_parts else None
    email  = p.get("work_email") or (p.get("emails") or [{}])[0].get("address") if p.get("emails") else None
    phone  = (p.get("phone_numbers") or [None])[0]
    li_url = p.get("linkedin_url")
    if li_url and not li_url.startswith("http"):
        li_url = "https://" + li_url
    lead_data = {k: v for k, v in {
        "user_id":     user_id,
        "name":        name or None,
        "email":       email,
        "title":       p.get("job_title") or None,
        "company":     p.get("job_company_name") or None,
        "location":    location,
        "linkedin_url": li_url,
        "phone":       phone,
        "status":      "new",
        "source":      "prospect_search",
    }.items() if v}
    # dedup by email
    if lead_data.get("email"):
        dup = supabase.table("leads").select("id").eq("user_id", user_id).eq("email", lead_data["email"]).execute()
        if dup.data:
            return {"added": False, "reason": "Already in leads", "lead_id": dup.data[0]["id"]}
    # dedup by linkedin_url
    if lead_data.get("linkedin_url"):
        dup = supabase.table("leads").select("id").eq("user_id", user_id).eq("linkedin_url", lead_data["linkedin_url"]).execute()
        if dup.data:
            return {"added": False, "reason": "Already in leads", "lead_id": dup.data[0]["id"]}
    res = supabase.table("leads").insert(lead_data).execute()
    inserted = res.data[0] if res.data else {}
    return {"added": True, "lead_id": inserted.get("id")}


# ═══════════════════════════════════════════════════════════════════
# WEBHOOKS
# ═══════════════════════════════════════════════════════════════════

import hashlib as _hashlib
import hmac as _hmac

WEBHOOK_EVENTS = [
    "lead.created",
    "lead.status_changed",
    "sequence.replied",
    "sequence.completed",
    "email.opened",
]

def _fire_webhooks(user_id: str, event: str, payload: dict):
    """Fire webhooks for a user event. Best-effort, non-blocking."""
    try:
        hooks = supabase.table("webhooks")\
            .select("id, url, secret")\
            .eq("user_id", user_id)\
            .eq("active", True)\
            .contains("events", [event])\
            .execute().data or []
        for hook in hooks:
            body = json.dumps({"event": event, "data": payload, "timestamp": datetime.utcnow().isoformat() + "Z"})
            headers = {"Content-Type": "application/json", "X-Sonar-Event": event}
            if hook.get("secret"):
                sig = _hmac.new(hook["secret"].encode(), body.encode(), _hashlib.sha256).hexdigest()
                headers["X-Sonar-Signature"] = f"sha256={sig}"
            try:
                r = requests.post(hook["url"], data=body, headers=headers, timeout=6)
                ok = r.status_code < 400
            except Exception:
                ok = False
            supabase.table("webhooks").update({
                "last_triggered_at": datetime.utcnow().isoformat(),
                "delivery_count": supabase.table("webhooks").select("delivery_count").eq("id", hook["id"]).execute().data[0]["delivery_count"] + 1,
                **({"error_count": supabase.table("webhooks").select("error_count").eq("id", hook["id"]).execute().data[0]["error_count"] + 1} if not ok else {}),
            }).eq("id", hook["id"]).execute()
    except Exception:
        pass


@router.get("/webhooks")
async def list_webhooks(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("webhooks").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return {"webhooks": res.data or []}


@router.post("/webhooks")
async def create_webhook(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    url = (payload.get("url") or "").strip()
    name = (payload.get("name") or "").strip()
    events = payload.get("events") or []
    if not url:
        raise HTTPException(status_code=400, detail="Valid URL required")
    validate_external_url(url, "url")
    if not events:
        raise HTTPException(status_code=400, detail="At least one event required")
    unknown = [e for e in events if e not in WEBHOOK_EVENTS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown events: {unknown}")
    secret = payload.get("secret") or None
    res = supabase.table("webhooks").insert({
        "user_id": user_id,
        "name": name or url,
        "url": url,
        "events": events,
        "secret": secret,
        "active": True,
    }).execute()
    return {"webhook": res.data[0] if res.data else {}}


@router.patch("/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(webhook_id)
    updates = {k: v for k, v in payload.items() if k in ("name", "url", "events", "secret", "active")}
    res = supabase.table("webhooks").update(updates).eq("id", webhook_id).eq("user_id", user_id).execute()
    return {"webhook": res.data[0] if res.data else {}}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(webhook_id)
    supabase.table("webhooks").delete().eq("id", webhook_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# SONAR DATABASE — proprietary contact database (GitHub + company sites)
# ═══════════════════════════════════════════════════════════════════════════════

from app.github_scraper import run_scrape_job, SCRAPE_QUERIES
import threading as _db_thread

_scrape_lock = _db_thread.Lock()
_scrape_state: dict = {"running": False, "last_run": None, "last_result": None, "query_index": 0}


@router.get("/database/stats")
async def database_stats(authorization: str = Header(...)):
    """Total contacts, breakdown by source, recent additions."""
    get_user_id(authorization)
    total_res  = supabase.table("sonar_contacts").select("id", count="exact").execute()
    email_res  = supabase.table("sonar_contacts").select("id", count="exact").not_.is_("email", "null").execute()
    github_res = supabase.table("sonar_contacts").select("id", count="exact").eq("source", "github").execute()
    recent_res = supabase.table("sonar_contacts").select("*").order("scraped_at", desc=True).limit(5).execute()

    return {
        "total":        total_res.count or 0,
        "with_email":   email_res.count or 0,
        "by_source":    {"github": github_res.count or 0},
        "recent":       recent_res.data or [],
        "scrape_state": {
            "running":     _scrape_state["running"],
            "last_run":    _scrape_state["last_run"],
            "last_result": _scrape_state["last_result"],
        },
    }


@router.post("/database/search")
async def database_search(payload: dict, authorization: str = Header(...)):
    """
    Search the proprietary Sonar contact database.
    Supports: name, email, company, domain, location, source filters.
    """
    get_user_id(authorization)

    q        = (payload.get("q") or "").strip()
    company  = (payload.get("company") or "").strip()
    domain   = (payload.get("domain") or "").strip().lower()
    location = (payload.get("location") or "").strip()
    source   = (payload.get("source") or "").strip()
    page     = max(int(payload.get("page", 1)), 1)
    per_page = min(int(payload.get("per_page", 25)), 100)
    offset   = (page - 1) * per_page

    query = supabase.table("sonar_contacts").select("*", count="exact")

    if q:
        # Search across name and email
        query = query.or_(f"full_name.ilike.%{q}%,email.ilike.%{q}%")
    if company:
        query = query.ilike("job_company_name", f"%{company}%")
    if domain:
        query = query.eq("domain", domain)
    if location:
        query = query.or_(f"location_locality.ilike.%{location}%,location_country.ilike.%{location}%")
    if source:
        query = query.eq("source", source)

    result = query.order("followers", desc=True).range(offset, offset + per_page - 1).execute()

    total       = result.count or 0
    total_pages = max((total + per_page - 1) // per_page, 1)

    return {
        "contacts":    result.data or [],
        "total":       total,
        "page":        page,
        "total_pages": total_pages,
    }


@router.post("/database/scrape")
async def database_scrape(authorization: str = Header(...)):
    """
    Trigger a GitHub scrape run (admin only).
    Runs synchronously with a small batch — keep max_users low enough to finish within Vercel's 60s Hobby limit.
    """
    user_id = get_user_id(authorization)
    profile = _first(supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute()) or {}
    if profile.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    if _scrape_state.get("running"):
        raise HTTPException(status_code=409, detail="Scrape already running")

    _scrape_state["running"] = True
    try:
        from datetime import datetime as _dt
        qi     = _scrape_state.get("query_index", 0)
        result = run_scrape_job(supabase, query_index=qi, max_users=50)
        _scrape_state["last_result"]  = result
        _scrape_state["last_run"]     = _dt.utcnow().isoformat() + "Z"
        _scrape_state["query_index"]  = (qi + 1) % len(SCRAPE_QUERIES)
        return {"ok": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scrape failed: {exc}") from exc
    finally:
        _scrape_state["running"] = False


@router.post("/cron/scrape-github")
async def cron_scrape_github(request: Request):
    """Vercel cron endpoint — runs daily to grow the contact database."""
    verify_cron_auth(request)

    qi     = _scrape_state.get("query_index", 0)
    result = run_scrape_job(supabase, query_index=qi, max_users=100)
    _scrape_state["last_result"] = result
    _scrape_state["last_run"]    = datetime.utcnow().isoformat() + "Z"
    _scrape_state["query_index"] = (qi + 1) % len(SCRAPE_QUERIES)
    return {"ok": True, **result}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    validate_uuid(webhook_id)
    hook = supabase.table("webhooks").select("*").eq("id", webhook_id).eq("user_id", user_id).limit(1).execute()
    if not hook.data:
        raise HTTPException(status_code=404, detail="Webhook not found")
    h = hook.data[0]
    body = json.dumps({
        "event": "test",
        "data": {"message": "This is a test payload from Sonar.", "webhook_id": webhook_id},
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })
    headers = {"Content-Type": "application/json", "X-Sonar-Event": "test"}
    if h.get("secret"):
        sig = _hmac.new(h["secret"].encode(), body.encode(), _hashlib.sha256).hexdigest()
        headers["X-Sonar-Signature"] = f"sha256={sig}"
    try:
        r = requests.post(h["url"], data=body, headers=headers, timeout=8)
        return {"ok": r.status_code < 400, "status_code": r.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── LOOKALIKE FINDER ─────────────────────────────────────────

@router.post("/companies/{company_id}/lookalike")
async def find_lookalike_companies(company_id: str, authorization: str = Header(...)):
    """Find similar companies based on industry, tech stack, and size."""
    user_id = get_user_id(authorization)
    co_res = supabase.table("companies").select(
        "id,name,website,industry,size,classification,tech_stack,headquarters"
    ).eq("id", company_id).eq("user_id", user_id).limit(1).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    company = co_res.data[0]
    name = company.get("name", "")
    industry = company.get("industry") or ""
    size = company.get("size") or ""
    hq = company.get("headquarters") or ""
    tech_stack = company.get("tech_stack") or []
    classification = company.get("classification") or ""

    # Build search queries
    queries = []
    if industry:
        queries.append(f'companies similar to "{name}" {industry} B2B software')
    if tech_stack and isinstance(tech_stack, list) and len(tech_stack) > 0:
        top_tech = ", ".join(tech_stack[:3])
        queries.append(f'B2B companies using {top_tech} {industry}')
    queries.append(f'alternatives to "{name}" competitors {industry}')

    results = []
    seen_domains = set()
    try:
        from ddgs import DDGS
        import re as _lre
        with DDGS() as d:
            for q in queries:
                if len(results) >= 12:
                    break
                for r in d.text(q, max_results=6):
                    href = r.get("href") or ""
                    title = (r.get("title") or "").strip()
                    snippet = (r.get("body") or r.get("snippet") or "").strip()
                    if not href or not title:
                        continue
                    # Skip the company itself and junk
                    if name.lower() in href.lower():
                        continue
                    if any(s in href for s in ["linkedin.com", "twitter.com", "facebook.com", "reddit.com", "wikipedia.org", "youtube.com"]):
                        continue
                    try:
                        from urllib.parse import urlparse as _lup
                        dom = _lup(href).netloc.replace("www.", "").lower()
                    except Exception:
                        dom = href
                    if not dom or dom in seen_domains:
                        continue
                    seen_domains.add(dom)
                    results.append({"name": title[:80], "url": href, "domain": dom, "snippet": snippet[:150]})
    except Exception:
        pass

    return {"lookalikes": results[:10]}


# ─── LINKEDIN DM GENERATOR ────────────────────────────────────

@router.post("/companies/{company_id}/generate-dm")
async def generate_linkedin_dm(company_id: str, payload: dict = {}, authorization: str = Header(...)):
    """Generate a personalised LinkedIn DM for this company using Groq."""
    user_id = get_user_id(authorization)
    co_res = supabase.table("companies").select(
        "id,name,website,industry,size,description,tech_stack,revenue_estimate,recent_news,job_openings"
    ).eq("id", company_id).eq("user_id", user_id).limit(1).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    company = co_res.data[0]
    name = company.get("name", "")
    industry = company.get("industry") or ""
    desc = company.get("description") or ""
    size = company.get("size") or ""
    stack = company.get("tech_stack") or []
    news = company.get("recent_news") or []
    jobs = company.get("job_openings") or []
    revenue = company.get("revenue_estimate") or ""
    persona = payload.get("persona", "")  # optional target persona/role

    stack_str = ", ".join(stack[:5]) if isinstance(stack, list) else ""
    news_str = news[0].get("title", "") if isinstance(news, list) and news else ""
    jobs_str = jobs[0].get("title", "") if isinstance(jobs, list) and jobs else ""

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=500, detail="Groq key not configured")

    context = f"""Company: {name}
Industry: {industry}
Size: {size}
Description: {desc[:300]}
Tech stack: {stack_str}
Recent news: {news_str}
Open role: {jobs_str}
Revenue est: {revenue}
Target persona: {persona or 'decision maker'}"""

    import requests as _dmr
    res = _dmr.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
        json={
            "model": "llama-3.1-8b-instant",
            "messages": [{"role": "user", "content": (
                f"Write a short, personalised LinkedIn cold outreach message (under 300 chars) to a {persona or 'decision maker'} at {name}.\n\n"
                f"Context:\n{context}\n\n"
                "Rules:\n"
                "- Start with a specific, genuine observation about their company (not generic)\n"
                "- One clear value prop sentence\n"
                "- Soft CTA (open question, not 'book a call')\n"
                "- No emojis. No 'I hope this finds you well'. Sound like a human.\n"
                "- Under 300 characters total.\n"
                "Return ONLY the message text."
            )}],
            "max_tokens": 120,
            "temperature": 0.7,
        },
        timeout=12,
    )
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="AI generation failed")
    msg = res.json()["choices"][0]["message"]["content"].strip().strip('"')
    posthog.capture(user_id, "linkedin_dm_generated", {"company": name})
    return {"message": msg}


# ─── COMPANY ACTIVITIES (TIMELINE) ───────────────────────────

@router.get("/companies/{company_id}/activities")
async def get_company_activities(company_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("company_activities").select("*")\
        .eq("company_id", company_id).eq("user_id", user_id)\
        .order("created_at", desc=True).limit(50).execute()
    return {"activities": res.data or []}


@router.post("/companies/{company_id}/activities")
async def create_company_activity(company_id: str, payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    row = {
        "company_id": company_id,
        "user_id": user_id,
        "type": payload.get("type", "note"),
        "note": payload.get("note", ""),
        "metadata": payload.get("metadata") or {},
    }
    res = supabase.table("company_activities").insert(row).execute()
    posthog.capture(user_id, "company_activity_logged", {"type": row["type"]})
    return {"activity": res.data[0] if res.data else row}


@router.delete("/company-activities/{activity_id}")
async def delete_company_activity(activity_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("company_activities").delete()\
        .eq("id", activity_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ─── DUPLICATE DETECTION ─────────────────────────────────────

@router.post("/companies/find-duplicates")
async def find_duplicate_companies(authorization: str = Header(...)):
    """Find companies with the same root domain or very similar names."""
    user_id = get_user_id(authorization)
    res = supabase.table("companies").select("id,name,website").eq("user_id", user_id).execute()
    companies_all = res.data or []

    from urllib.parse import urlparse as _dup
    import re as _dre

    def _root(url):
        if not url:
            return ""
        try:
            h = _dup(url if "://" in url else "https://" + url).netloc.lower()
            h = h.replace("www.", "")
            parts = h.split(".")
            return ".".join(parts[-2:]) if len(parts) >= 2 else h
        except Exception:
            return ""

    def _slug(name):
        return _dre.sub(r'[^a-z0-9]', '', (name or "").lower())

    # Group by root domain
    domain_map: dict = {}
    for c in companies_all:
        root = _root(c.get("website", ""))
        if root:
            domain_map.setdefault(root, []).append(c)

    # Group by name slug (catch "Acme Inc" vs "Acme")
    name_map: dict = {}
    for c in companies_all:
        slug = _slug(c.get("name", ""))
        if len(slug) >= 4:
            name_map.setdefault(slug, []).append(c)

    groups = []
    seen_pairs: set = set()

    for bucket in list(domain_map.values()) + list(name_map.values()):
        if len(bucket) < 2:
            continue
        key = frozenset(c["id"] for c in bucket)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        groups.append([{"id": c["id"], "name": c["name"], "website": c.get("website", "")} for c in bucket])

    return {"groups": groups}


@router.post("/companies/{company_id}/merge/{other_id}")
async def merge_companies(company_id: str, other_id: str, authorization: str = Header(...)):
    """Merge other_id into company_id (keep company_id, delete other_id)."""
    user_id = get_user_id(authorization)
    # Move leads from other → primary
    try:
        supabase.table("leads").update({"company_id": company_id})\
            .eq("company_id", other_id).eq("user_id", user_id).execute()
    except Exception:
        pass
    # Move activities
    try:
        supabase.table("company_activities").update({"company_id": company_id})\
            .eq("company_id", other_id).eq("user_id", user_id).execute()
    except Exception:
        pass
    # Delete the duplicate
    supabase.table("companies").delete().eq("id", other_id).eq("user_id", user_id).execute()
    posthog.capture(user_id, "companies_merged")
    return {"ok": True}


# ─── COMPANY ALERTS ───────────────────────────────────────────

@router.get("/companies/alerts")
async def get_company_alerts(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("company_alerts").select("*")\
        .eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
    return {"alerts": res.data or []}


@router.patch("/companies/alerts/{alert_id}/seen")
async def mark_alert_seen(alert_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("company_alerts").update({"seen": True})\
        .eq("id", alert_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/companies/alerts/refresh")
async def refresh_company_alerts(authorization: str = Header(...)):
    """Scan tracked Prospect companies for new news/funding/hiring spikes and store alerts."""
    user_id = get_user_id(authorization)
    cos = supabase.table("companies").select("id,name,website,industry,job_openings")\
        .eq("user_id", user_id).eq("prospect_status", "Prospect").execute()
    companies_to_scan = (cos.data or [])[:20]  # cap at 20

    from ddgs import DDGS
    import re as _are
    new_alerts = []

    for company in companies_to_scan:
        name = company.get("name", "")
        domain = ""
        if company.get("website"):
            try:
                from urllib.parse import urlparse as _aup
                domain = _aup(company["website"]).netloc.replace("www.", "").lower()
            except Exception:
                pass

        # Check for recent news
        try:
            with DDGS() as d:
                for r in d.text(f'"{name}" 2025 OR 2026 funding OR acquisition OR launch OR partnership', max_results=3):
                    title = (r.get("title") or "").strip()
                    href = r.get("href") or ""
                    snippet = (r.get("body") or "").strip()
                    if not title or not href:
                        continue
                    if any(s in href for s in ["linkedin.com", "facebook.com", "twitter.com"]):
                        continue
                    # Check if alert already exists for this url
                    existing = supabase.table("company_alerts").select("id")\
                        .eq("company_id", company["id"]).eq("url", href).execute()
                    if existing.data:
                        continue
                    new_alerts.append({
                        "company_id": company["id"],
                        "user_id": user_id,
                        "type": "news",
                        "title": title[:200],
                        "body": snippet[:400],
                        "url": href,
                        "seen": False,
                    })
                    break  # one alert per company per scan
        except Exception:
            continue

    if new_alerts:
        supabase.table("company_alerts").insert(new_alerts).execute()
        # Fire webhooks for each alert
        for alert in new_alerts:
            try:
                co_name = next((c["name"] for c in companies_to_scan if c["id"] == alert["company_id"]), "")
                _fire_webhooks(user_id, "company.alert", {
                    "company": co_name,
                    "type": alert["type"],
                    "title": alert["title"],
                    "url": alert.get("url", ""),
                })
            except Exception:
                pass

    posthog.capture(user_id, "company_alerts_refreshed", {"new": len(new_alerts)})
    return {"ok": True, "new_alerts": len(new_alerts)}


# ─── COMPANY SEGMENTS ─────────────────────────────────────────

@router.get("/company-segments")
async def list_company_segments(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("company_segments").select("*")\
        .eq("user_id", user_id).order("created_at", desc=True).execute()
    return {"segments": res.data or []}


@router.post("/company-segments")
async def create_company_segment(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    row = {
        "user_id": user_id,
        "name": payload.get("name", "Untitled segment"),
        "filters": payload.get("filters", {}),
    }
    res = supabase.table("company_segments").insert(row).execute()
    posthog.capture(user_id, "company_segment_saved")
    return {"segment": res.data[0] if res.data else row}


@router.delete("/company-segments/{seg_id}")
async def delete_company_segment(seg_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    supabase.table("company_segments").delete()\
        .eq("id", seg_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ─── FEATURE FLAGS ────────────────────────────────────────────

@router.get("/feature-flags")
async def get_feature_flags():
    """Public endpoint — returns all feature flags (enabled/disabled)."""
    res = supabase.table("feature_flags").select("name,label,description,enabled,category")\
        .order("category").order("label").execute()
    return {"flags": res.data or []}


@router.patch("/feature-flags/{name}")
async def update_feature_flag(name: str, payload: dict, authorization: str = Header(...)):
    """Admin-only: toggle a feature flag."""
    user_id = get_user_id(authorization)
    # Verify admin role
    profile = _first(supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute())
    if not profile or profile.get("role") not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Admin access required")
    enabled = payload.get("enabled")
    if enabled is None:
        raise HTTPException(status_code=400, detail="enabled field required")
    import datetime as _dt
    supabase.table("feature_flags").update({
        "enabled": bool(enabled),
        "updated_at": _dt.datetime.utcnow().isoformat(),
    }).eq("name", name).execute()
    posthog.capture(user_id, "feature_flag_toggled", {"flag": name, "enabled": enabled})
    return {"ok": True, "name": name, "enabled": bool(enabled)}


# ─── ADMIN STATS ─────────────────────────────────────────────────

@router.get("/admin/stats")
async def admin_stats(authorization: str = Header(...)):
    """Platform-wide stats for the admin dashboard."""
    user_id = get_user_id(authorization)
    profile = _first(supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute())
    if not profile or profile.get("role") not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from datetime import datetime, timedelta
    now = datetime.utcnow()
    day7 = (now - timedelta(days=7)).isoformat()
    day30 = (now - timedelta(days=30)).isoformat()

    def count(table, filters=None):
        q = supabase.table(table).select("id", count="exact").limit(1)
        if filters:
            for col, val in filters.items():
                q = q.gte(col, val)
        return q.execute().count or 0

    stats = {
        "users": {
            "total":    count("profiles"),
            "last_7d":  count("profiles", {"created_at": day7}),
            "last_30d": count("profiles", {"created_at": day30}),
        },
        "companies": {
            "total":    count("companies"),
            "last_7d":  count("companies", {"created_at": day7}),
            "last_30d": count("companies", {"created_at": day30}),
        },
        "leads": {
            "total":    count("leads"),
            "last_7d":  count("leads", {"created_at": day7}),
            "last_30d": count("leads", {"created_at": day30}),
        },
        "sequences": {
            "total":       count("sequences"),
            "enrollments": count("sequence_enrollments"),
        },
        "tasks":      {"total": count("tasks")},
        "unsubscribes": {"total": count("unsubscribes")},
        "email_clicks": {"total": count("email_clicks")},
    }

    # Recent users with activity summary
    recent_users = supabase.table("profiles").select(
        "id,email,full_name,role,created_at"
    ).order("created_at", desc=True).limit(20).execute()

    user_rows = []
    for u in (recent_users.data or []):
        co_count = count("companies", {}) if False else None  # skip per-user for perf
        user_rows.append({
            "id":         u.get("id"),
            "email":      u.get("email"),
            "name":       u.get("full_name") or "",
            "role":       u.get("role") or "member",
            "joined":     (u.get("created_at") or "")[:10],
        })

    # Per-user data counts (batch)
    co_counts  = supabase.table("companies").select("user_id", count="exact").execute()
    lead_counts = supabase.table("leads").select("user_id", count="exact").execute()

    # Aggregate by user_id
    co_by_user   = {}
    lead_by_user = {}
    for row in (supabase.table("companies").select("user_id").execute().data or []):
        uid = row.get("user_id")
        co_by_user[uid] = co_by_user.get(uid, 0) + 1
    for row in (supabase.table("leads").select("user_id").execute().data or []):
        uid = row.get("user_id")
        lead_by_user[uid] = lead_by_user.get(uid, 0) + 1

    for u in user_rows:
        uid = u["id"]
        u["companies"] = co_by_user.get(uid, 0)
        u["leads"]     = lead_by_user.get(uid, 0)

    return {"stats": stats, "recent_users": user_rows}


# ── ADMIN HELPER ─────────────────────────────────────────────────────────────

def _require_any_admin(user_id: str):
    """Allow admin OR owner role (no team required)."""
    row = _first(supabase.table("profiles").select("role,email").eq("id", user_id).limit(1).execute())
    if not row or row.get("role") not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return row


# ── ADMIN: ALL USERS (searchable / paginated) ─────────────────────────────────

@router.get("/admin/all-users")
async def admin_all_users(
    authorization: str = Header(...),
    search: str = "",
    role: str = "",
    page: int = 0,
):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    limit = 50
    q = supabase.table("profiles").select(
        "id,email,full_name,role,created_at,suspended"
    ).order("created_at", desc=True).range(page * limit, (page + 1) * limit - 1)
    if role:
        q = q.eq("role", role)
    rows = q.execute().data or []

    if search:
        s = search.lower()
        rows = [r for r in rows if s in (r.get("email") or "").lower() or s in (r.get("full_name") or "").lower()]

    all_cos   = supabase.table("companies").select("user_id").execute().data or []
    all_leads = supabase.table("leads").select("user_id").execute().data or []
    co_map, lead_map = {}, {}
    for c in all_cos:
        uid = c.get("user_id"); co_map[uid] = co_map.get(uid, 0) + 1
    for l in all_leads:
        uid = l.get("user_id"); lead_map[uid] = lead_map.get(uid, 0) + 1
    for r in rows:
        uid = r["id"]
        r["companies"] = co_map.get(uid, 0)
        r["leads"]     = lead_map.get(uid, 0)

    total = supabase.table("profiles").select("id", count="exact").limit(1).execute().count or 0
    return {"users": rows, "total": total, "page": page}


@router.patch("/admin/users/{target_id}")
async def admin_update_user(target_id: str, payload: dict, authorization: str = Header(...)):
    validate_uuid(target_id, "target_id")
    user_id = get_user_id(authorization)
    admin   = _require_any_admin(user_id)
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot edit yourself here")
    updates = {}
    if "role" in payload:
        if payload["role"] not in ("member", "admin", "owner"):
            raise HTTPException(status_code=422, detail="Invalid role")
        updates["role"] = payload["role"]
    if "full_name" in payload:
        updates["full_name"] = (payload["full_name"] or "").strip()
    if "suspended" in payload:
        updates["suspended"] = bool(payload["suspended"])
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    supabase.table("profiles").update(updates).eq("id", target_id).execute()
    supabase.table("admin_audit_log").insert({
        "admin_id": user_id,
        "admin_email": admin.get("email", ""),
        "action": "update_user",
        "target": target_id,
        "metadata": updates,
    }).execute()
    return {"ok": True}


# ── ADMIN: AUDIT LOG ─────────────────────────────────────────────────────────

@router.get("/admin/audit-logs")
async def get_audit_logs(
    authorization: str = Header(...),
    page: int = 0,
    action: str = "",
):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    limit = 100
    q = supabase.table("admin_audit_log").select(
        "id,admin_email,action,target,metadata,created_at"
    ).order("created_at", desc=True).range(page * limit, (page + 1) * limit - 1)
    if action:
        q = q.eq("action", action)
    return {"logs": q.execute().data or [], "page": page}


@router.post("/admin/audit-log")
async def write_audit_log(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    admin   = _require_any_admin(user_id)
    supabase.table("admin_audit_log").insert({
        "admin_id":    user_id,
        "admin_email": admin.get("email", ""),
        "action":      payload.get("action", ""),
        "target":      payload.get("target", ""),
        "metadata":    payload.get("metadata", {}),
    }).execute()
    return {"ok": True}


# ── ADMIN: ANNOUNCEMENTS ─────────────────────────────────────────────────────

@router.get("/admin/announcements")
async def list_announcements(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    res = supabase.table("announcements").select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.post("/admin/announcements")
async def create_announcement(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    admin   = _require_any_admin(user_id)
    title = (payload.get("title") or "").strip()
    body  = (payload.get("body") or "").strip()
    kind  = payload.get("kind", "info")
    if not title:
        raise HTTPException(status_code=422, detail="title is required")
    if kind not in ("info", "warning", "success", "error"):
        kind = "info"
    supabase.table("announcements").insert({
        "title": title, "body": body, "kind": kind,
        "created_by": user_id, "active": True,
    }).execute()
    supabase.table("admin_audit_log").insert({
        "admin_id": user_id, "admin_email": admin.get("email", ""),
        "action": "announcement_created", "target": title, "metadata": {"kind": kind},
    }).execute()
    return {"ok": True}


@router.patch("/admin/announcements/{ann_id}")
async def update_announcement(ann_id: str, payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    updates = {k: payload[k] for k in ("title", "body", "kind", "active") if k in payload}
    if updates:
        supabase.table("announcements").update(updates).eq("id", ann_id).execute()
    return {"ok": True}


@router.delete("/admin/announcements/{ann_id}")
async def delete_announcement(ann_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    supabase.table("announcements").delete().eq("id", ann_id).execute()
    return {"ok": True}


# ── ADMIN: GROWTH CHART DATA ─────────────────────────────────────────────────

@router.get("/admin/growth")
async def admin_growth(authorization: str = Header(...)):
    """Daily new users / companies / leads for the past 30 days."""
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    from datetime import datetime, timedelta
    days = [(datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]
    start = (datetime.utcnow() - timedelta(days=30)).isoformat()

    def counts_by_day(table):
        rows = supabase.table(table).select("created_at").gte("created_at", start).execute().data or []
        by_day = {}
        for r in rows:
            d = (r.get("created_at") or "")[:10]
            if d:
                by_day[d] = by_day.get(d, 0) + 1
        return [by_day.get(d, 0) for d in days]

    return {
        "days":      days,
        "users":     counts_by_day("profiles"),
        "companies": counts_by_day("companies"),
        "leads":     counts_by_day("leads"),
    }


# ── ADMIN: AUTH-USER HELPER ───────────────────────────────────────────────────

def _list_all_auth_users():
    try:
        resp = supabase.auth.admin.list_users()
        if isinstance(resp, list):
            return resp
        return getattr(resp, 'users', []) or []
    except Exception:
        return []


# ── ADMIN: USER DETAIL ────────────────────────────────────────────────────────

@router.get("/admin/user/{target_id}")
async def admin_user_detail(target_id: str, authorization: str = Header(...)):
    validate_uuid(target_id, "target_id")
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    profile_data = _first(supabase.table("profiles").select("*").eq("id", target_id).limit(1).execute())
    if not profile_data:
        raise HTTPException(status_code=404, detail="User not found")

    # Auth info (last sign in)
    auth_info = {}
    try:
        auth_resp = supabase.auth.admin.get_user_by_id(target_id)
        u = getattr(auth_resp, 'user', auth_resp)
        auth_info = {
            "last_sign_in": str(u.last_sign_in_at) if u.last_sign_in_at else None,
            "email_confirmed": bool(getattr(u, 'email_confirmed_at', None)),
        }
    except Exception:
        pass

    def cnt(table):
        return supabase.table(table).select("id", count="exact").eq("user_id", target_id).limit(1).execute().count or 0

    return {
        "profile": profile_data,
        "auth": auth_info,
        "counts": {
            "companies": cnt("companies"),
            "leads":     cnt("leads"),
            "sequences": cnt("sequences"),
            "tasks":     cnt("tasks"),
        },
        "recent_companies": (supabase.table("companies").select("id,name,domain,created_at").eq("user_id", target_id).order("created_at", desc=True).limit(8).execute().data or []),
        "recent_leads":     (supabase.table("leads").select("id,first_name,last_name,email,company,created_at").eq("user_id", target_id).order("created_at", desc=True).limit(8).execute().data or []),
        "recent_sequences": (supabase.table("sequences").select("id,name,created_at").eq("user_id", target_id).order("created_at", desc=True).limit(5).execute().data or []),
    }


# ── ADMIN: ENGAGEMENT (DAU/WAU/MAU + TOP USERS) ───────────────────────────────

@router.get("/admin/engagement")
async def admin_engagement(authorization: str = Header(...)):
    from datetime import datetime, timedelta
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    now   = datetime.utcnow()
    d1    = (now - timedelta(days=1)).isoformat()
    d7    = (now - timedelta(days=7)).isoformat()
    d30   = (now - timedelta(days=30)).isoformat()

    all_users = _list_all_auth_users()

    def sign_in(u):
        v = getattr(u, 'last_sign_in_at', None)
        return str(v) if v else ""

    dau = sum(1 for u in all_users if sign_in(u) >= d1)
    wau = sum(1 for u in all_users if sign_in(u) >= d7)
    mau = sum(1 for u in all_users if sign_in(u) >= d30)
    inactive_count = sum(1 for u in all_users if not sign_in(u) or sign_in(u) < d30)

    profiles  = supabase.table("profiles").select("id,email,full_name,role").execute().data or []
    co_rows   = supabase.table("companies").select("user_id").execute().data or []
    lead_rows = supabase.table("leads").select("user_id").execute().data or []
    co_map, lead_map = {}, {}
    for r in co_rows:   uid = r.get("user_id"); co_map[uid]   = co_map.get(uid, 0) + 1
    for r in lead_rows: uid = r.get("user_id"); lead_map[uid] = lead_map.get(uid, 0) + 1

    for p in profiles:
        uid = p["id"]
        p["companies"] = co_map.get(uid, 0)
        p["leads"]     = lead_map.get(uid, 0)

    top_co   = sorted(profiles, key=lambda p: p["companies"], reverse=True)[:10]
    top_lead = sorted(profiles, key=lambda p: p["leads"],     reverse=True)[:10]

    return {"dau": dau, "wau": wau, "mau": mau, "inactive_count": inactive_count,
            "top_by_companies": top_co, "top_by_leads": top_lead}


# ── ADMIN: INACTIVE USERS ────────────────────────────────────────────────────

@router.get("/admin/inactive-users")
async def admin_inactive_users(authorization: str = Header(...), days: int = 30):
    from datetime import datetime, timedelta
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    all_users = _list_all_auth_users()
    inactive = []
    for u in all_users:
        si = str(getattr(u, 'last_sign_in_at', '') or '')
        ca = str(getattr(u, 'created_at', '') or '')
        if not si or si < cutoff:
            inactive.append({"id": str(getattr(u, 'id', '')), "email": getattr(u, 'email', ''), "last_sign_in": si or None, "created_at": ca})
    inactive.sort(key=lambda x: x.get("last_sign_in") or "")
    return {"users": inactive, "count": len(inactive), "days": days}


# ── ADMIN: EXPORT USERS CSV ──────────────────────────────────────────────────

@router.get("/admin/export/users")
async def export_users_csv(authorization: str = Header(...)):
    import csv, io
    from fastapi.responses import StreamingResponse
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    profiles  = supabase.table("profiles").select("id,email,full_name,role,created_at,suspended").order("created_at", desc=True).execute().data or []
    co_rows   = supabase.table("companies").select("user_id").execute().data or []
    lead_rows = supabase.table("leads").select("user_id").execute().data or []
    co_map, lead_map = {}, {}
    for r in co_rows:   uid = r.get("user_id"); co_map[uid]   = co_map.get(uid, 0) + 1
    for r in lead_rows: uid = r.get("user_id"); lead_map[uid] = lead_map.get(uid, 0) + 1

    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=["email","full_name","role","companies","leads","suspended","joined"])
    w.writeheader()
    for p in profiles:
        uid = p["id"]
        w.writerow({"email": p.get("email",""), "full_name": p.get("full_name",""), "role": p.get("role",""),
                    "companies": co_map.get(uid,0), "leads": lead_map.get(uid,0),
                    "suspended": p.get("suspended",False), "joined": (p.get("created_at",""))[:10]})
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=sonar-users.csv"})


# ── ADMIN: SYSTEM HEALTH ─────────────────────────────────────────────────────

@router.get("/admin/health-check")
async def admin_health_check(authorization: str = Header(...)):
    import time as _time
    from datetime import datetime
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    checks = {}

    # Database
    t = _time.time()
    try:
        supabase.table("profiles").select("id").limit(1).execute()
        checks["database"] = {"status": "ok", "latency_ms": round((_time.time()-t)*1000)}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)[:120]}

    # External keys
    for key_name, env_var in [("pdl","PDL_API_KEY"),("hunter","HUNTER_API_KEY"),("apollo","APOLLO_API_KEY"),("resend","RESEND_API_KEY"),("openai","OPENAI_API_KEY")]:
        v = os.environ.get(env_var,"")
        checks[key_name] = {"status": "configured" if v else "missing", "prefix": (v[:6]+"…") if v else None}

    # Feature flags
    try:
        fc = supabase.table("feature_flags").select("id",count="exact").limit(1).execute().count or 0
        checks["feature_flags"] = {"status": "ok", "count": fc}
    except:
        checks["feature_flags"] = {"status": "error"}

    # User count
    try:
        uc = supabase.table("profiles").select("id",count="exact").limit(1).execute().count or 0
        checks["users"] = {"status": "ok", "count": uc}
    except:
        checks["users"] = {"status": "error"}

    return {"checks": checks, "timestamp": datetime.utcnow().isoformat()}


# ── ADMIN: EMAIL BLAST ───────────────────────────────────────────────────────

@router.post("/admin/email-blast")
async def email_blast(payload: dict, authorization: str = Header(...)):
    from datetime import datetime, timedelta
    user_id = get_user_id(authorization)
    admin   = _require_any_admin(user_id)

    subject = (payload.get("subject") or "").strip()
    body    = (payload.get("body") or "").strip()
    segment = payload.get("segment", "all")   # all | active | inactive

    if not subject or not body:
        raise HTTPException(status_code=422, detail="subject and body are required")

    resend_key = os.environ.get("RESEND_API_KEY","")
    if not resend_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")

    from_email = os.environ.get("EMAIL_FROM", "Sonar <noreply@sonarleads.io>")

    profiles = supabase.table("profiles").select("id,email,full_name").eq("suspended", False).execute().data or []

    if segment != "all":
        cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
        auth_users = _list_all_auth_users()
        active_ids = {str(getattr(u,'id','')) for u in auth_users if str(getattr(u,'last_sign_in_at','') or '') >= cutoff}
        if segment == "active":
            profiles = [p for p in profiles if p.get("id") in active_ids]
        elif segment == "inactive":
            profiles = [p for p in profiles if p.get("id") not in active_ids]

    emails = [p for p in profiles if p.get("email")][:500]
    if not emails:
        raise HTTPException(status_code=422, detail="No recipients in selected segment")

    sent = errors = 0
    for p in emails:
        html = f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<p style="font-size:15px;line-height:1.6;color:#111">{body.replace(chr(10),'<br>')}</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #eee">
<p style="font-size:12px;color:#888">You're receiving this from the Sonar team.</p>
</div>"""
        try:
            r = requests.post("https://api.resend.com/emails", json={"from": from_email, "to": [p["email"]], "subject": subject, "html": html},
                              headers={"Authorization": f"Bearer {resend_key}"}, timeout=10)
            if r.status_code in (200,201,202): sent += 1
            else: errors += 1
        except: errors += 1

    supabase.table("admin_audit_log").insert({
        "admin_id": user_id, "admin_email": admin.get("email",""),
        "action": "email_blast", "target": f"{sent} recipients",
        "metadata": {"subject": subject, "segment": segment, "sent": sent, "errors": errors},
    }).execute()

    return {"ok": True, "sent": sent, "errors": errors, "total": len(emails)}


# ── ADMIN: CHANGELOG ─────────────────────────────────────────────────────────

@router.get("/admin/changelog")
async def admin_list_changelog(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    return supabase.table("changelog").select("*").order("created_at", desc=True).execute().data or []

@router.post("/admin/changelog")
async def admin_create_changelog(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    admin   = _require_any_admin(user_id)
    title   = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="title is required")
    supabase.table("changelog").insert({
        "title":     title,
        "body":      (payload.get("body") or "").strip(),
        "version":   (payload.get("version") or "").strip(),
        "published": payload.get("published", True),
        "created_by": user_id,
    }).execute()
    supabase.table("admin_audit_log").insert({
        "admin_id": user_id, "admin_email": admin.get("email",""),
        "action": "changelog_created", "target": title,
    }).execute()
    return {"ok": True}

@router.patch("/admin/changelog/{entry_id}")
async def admin_update_changelog(entry_id: str, payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    updates = {k: payload[k] for k in ("title","body","version","published") if k in payload}
    if updates:
        supabase.table("changelog").update(updates).eq("id", entry_id).execute()
    return {"ok": True}

@router.delete("/admin/changelog/{entry_id}")
async def admin_delete_changelog(entry_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    supabase.table("changelog").delete().eq("id", entry_id).execute()
    return {"ok": True}


# ── PUBLIC: ANNOUNCEMENTS & CHANGELOG ────────────────────────────────────────

@router.get("/announcements/active")
async def public_active_announcements():
    """Public — returns active announcements for the main dashboard banner."""
    res = supabase.table("announcements").select("id,title,body,kind") \
        .eq("active", True).order("created_at", desc=True).execute()
    return res.data or []


@router.get("/changelog/public")
async def public_changelog():
    """Public — returns published changelog entries for the main dashboard."""
    res = supabase.table("changelog").select("id,title,body,version,created_at") \
        .eq("published", True).order("created_at", desc=True).limit(10).execute()
    return res.data or []


# ── ADMIN: GLOBAL SEARCH ─────────────────────────────────────────────────────

@router.get("/admin/search")
async def admin_search(authorization: str = Header(...), q: str = ""):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    if not q or len(q.strip()) < 2:
        return {"users": [], "companies": [], "leads": []}
    s = q.strip()
    users     = supabase.table("profiles").select("id,email,full_name,role").or_(f"email.ilike.%{s}%,full_name.ilike.%{s}%").limit(6).execute().data or []
    companies = supabase.table("companies").select("id,name,domain").or_(f"name.ilike.%{s}%,domain.ilike.%{s}%").limit(6).execute().data or []
    leads     = supabase.table("leads").select("id,first_name,last_name,email,company").or_(f"email.ilike.%{s}%,first_name.ilike.%{s}%,last_name.ilike.%{s}%,company.ilike.%{s}%").limit(6).execute().data or []
    return {"users": users, "companies": companies, "leads": leads}


# ── ADMIN: FEATURE ADOPTION ──────────────────────────────────────────────────

@router.get("/admin/feature-adoption")
async def admin_feature_adoption(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    total_users = max(supabase.table("profiles").select("id",count="exact").limit(1).execute().count or 1, 1)
    features = [
        ("Companies",   "companies"),
        ("Leads",       "leads"),
        ("Sequences",   "sequences"),
        ("Tasks",       "tasks"),
        ("Unsubscribes","unsubscribes"),
    ]
    result = []
    for name, table in features:
        try:
            rows = supabase.table(table).select("user_id").execute().data or []
            unique = len({r.get("user_id") for r in rows if r.get("user_id")})
            total  = supabase.table(table).select("id",count="exact").limit(1).execute().count or 0
            result.append({"name": name, "users_adopted": unique, "adoption_pct": round(unique/total_users*100,1), "total": total})
        except:
            result.append({"name": name, "users_adopted": 0, "adoption_pct": 0, "total": 0})
    return {"features": result, "total_users": total_users}


# ── ADMIN: RETENTION COHORTS ─────────────────────────────────────────────────

@router.get("/admin/retention")
async def admin_retention(authorization: str = Header(...)):
    from datetime import datetime, timedelta
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)

    now       = datetime.utcnow()
    all_users = _list_all_auth_users()

    cohorts = []
    for w in range(7, -1, -1):
        w_start = (now - timedelta(weeks=w+1)).isoformat()
        w_end   = (now - timedelta(weeks=w)).isoformat()
        label   = (now - timedelta(weeks=w+1)).strftime("%-m/%-d")
        cohort  = [u for u in all_users if w_start <= str(getattr(u,'created_at','') or '') < w_end]
        size    = len(cohort)
        active  = sum(1 for u in cohort if str(getattr(u,'last_sign_in_at','') or '') >= (now - timedelta(weeks=1)).isoformat())
        returned= sum(1 for u in cohort if str(getattr(u,'last_sign_in_at','') or '') > str(getattr(u,'created_at','') or ''))
        cohorts.append({"week": label, "size": size, "retained": active, "returned": returned,
                        "retention_pct": round(active/size*100,1) if size else 0})
    return {"cohorts": cohorts}


# ── ADMIN: LOGIN HISTORY (per user) ─────────────────────────────────────────

@router.get("/admin/login-history/{target_id}")
async def admin_login_history(target_id: str, authorization: str = Header(...)):
    validate_uuid(target_id, "target_id")
    user_id = get_user_id(authorization)
    _require_any_admin(user_id)
    try:
        resp = supabase.auth.admin.get_user_by_id(target_id)
        u    = getattr(resp, 'user', resp)
        return {
            "last_sign_in":     str(getattr(u,'last_sign_in_at','') or ''),
            "created_at":       str(getattr(u,'created_at','') or ''),
            "email_confirmed":  bool(getattr(u,'email_confirmed_at',None)),
            "updated_at":       str(getattr(u,'updated_at','') or ''),
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ═══════════════════════════════════════════════════════════════════
# EMAIL WARM-UP
# ═══════════════════════════════════════════════════════════════════

import random as _random
import datetime as _datetime_mod


_WARMUP_SUBJECTS = [
    "Quick check-in",
    "Following up",
    "Re: Our conversation",
    "Touching base",
    "A quick note",
    "Just checking in",
    "Re: Last week",
    "Quick question",
]

_WARMUP_BODIES = [
    "Hey, just wanted to reach out and see how things are going. Let me know if there's anything I can help with.",
    "Hi there — just circling back on our last conversation. Hope all is well on your end!",
    "Quick note to say hi and see if you'd like to connect soon. Always happy to chat.",
    "Just wanted to follow up and make sure everything is going smoothly. Feel free to reach out anytime.",
    "Hi! Hope you're having a great week. Let me know if there's anything useful I can share.",
    "Touching base to see how things are going. Looking forward to staying in touch.",
    "Just a quick hello — hope business is going well. Let me know if you ever want to catch up.",
    "Hi, wanted to check in and see if there's anything worth discussing. Happy to jump on a call anytime.",
]


@router.get("/profile/warmup-config")
async def get_warmup_config(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    res = supabase.table("warmup_configs").select("*").eq("user_id", user_id).limit(1).execute()
    if not res.data:
        return {"config": None, "day": 0, "daily_target": 0}
    cfg = res.data[0]
    # Compute current day since start_date
    start = cfg.get("start_date")
    if start:
        try:
            start_dt = _datetime_mod.datetime.fromisoformat(start.replace("Z", "+00:00"))
            day = max(0, (_datetime_mod.datetime.now(_datetime_mod.timezone.utc) - start_dt).days)
        except Exception:
            day = 0
    else:
        day = 0
    daily_target = min(2 + day * 2, 40)
    cfg["current_day"] = day
    cfg["daily_target"] = daily_target
    return {"config": cfg}


@router.patch("/profile/warmup-config")
async def save_warmup_config(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    # Upsert
    existing = supabase.table("warmup_configs").select("id").eq("user_id", user_id).limit(1).execute()
    data = {"user_id": user_id}
    if "enabled" in payload:
        data["enabled"] = bool(payload["enabled"])
    if "partner_emails" in payload:
        emails = [e.strip() for e in (payload["partner_emails"] or []) if e.strip()]
        data["partner_emails"] = emails
    if "start_date" in payload:
        data["start_date"] = payload["start_date"]
    if existing.data:
        supabase.table("warmup_configs").update(data).eq("user_id", user_id).execute()
    else:
        data.setdefault("start_date", _datetime_mod.datetime.now(_datetime_mod.timezone.utc).isoformat())
        supabase.table("warmup_configs").insert(data).execute()
    res = supabase.table("warmup_configs").select("*").eq("user_id", user_id).limit(1).execute()
    return {"config": res.data[0] if res.data else None}


@router.post("/sequences/warmup-cron")
async def warmup_cron(request: Request):
    """Vercel cron endpoint — runs daily to send warm-up emails for all enabled users."""
    verify_cron_auth(request)
    import smtplib as _smtp_wu
    from email.mime.text      import MIMEText      as _MIMEText_wu
    from email.mime.multipart import MIMEMultipart as _MIMEMultipart_wu

    cron_secret = os.environ.get("CRON_SECRET", "")
    provided = request.headers.get("authorization", "").replace("Bearer ", "").strip()
    if cron_secret and provided != cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    configs = supabase.table("warmup_configs").select("*").eq("enabled", True).execute()
    results = []

    for cfg in (configs.data or []):
        user_id       = cfg["user_id"]
        partner_emails = list(cfg.get("partner_emails") or [])
        if not partner_emails:
            # Auto-pool: borrow from_email of other warmup-enabled users who have SMTP configured
            pool_res = supabase.table("warmup_configs").select("user_id").eq("enabled", True).neq("user_id", user_id).execute()
            pool_ids = [r["user_id"] for r in (pool_res.data or [])]
            if pool_ids:
                pool_profiles = supabase.table("profiles").select("smtp_config").in_("id", pool_ids).execute()
                for p in (pool_profiles.data or []):
                    smtp_cfg = (p.get("smtp_config") or {})
                    email = smtp_cfg.get("from_email") or smtp_cfg.get("smtp_user")
                    if email:
                        partner_emails.append(email)
        if not partner_emails:
            results.append({"user_id": user_id, "skipped": "no pool members"})
            continue

        start = cfg.get("start_date")
        try:
            start_dt = _datetime_mod.datetime.fromisoformat(start.replace("Z", "+00:00"))
            day = max(0, (_datetime_mod.datetime.now(_datetime_mod.timezone.utc) - start_dt).days)
        except Exception:
            day = 0

        daily_target = min(2 + day * 2, 40)

        # Get SMTP config for user
        profile_res = _first(supabase.table("profiles").select("smtp_config").eq("id", user_id).limit(1).execute()) or {}
        smtp = profile_res.get("smtp_config") or {}
        if not smtp.get("smtp_user") or not smtp.get("smtp_pass"):
            results.append({"user_id": user_id, "skipped": "no smtp config"})
            continue

        smtp_host  = smtp.get("smtp_host", "smtp.gmail.com")
        smtp_port  = int(smtp.get("smtp_port", 587))
        from_email = smtp.get("from_email") or smtp["smtp_user"]
        from_name  = smtp.get("from_name") or ""

        sent_count = 0
        errors     = []
        for i in range(daily_target):
            to_email = partner_emails[i % len(partner_emails)]
            subject  = _random.choice(_WARMUP_SUBJECTS)
            body     = _random.choice(_WARMUP_BODIES)
            try:
                msg            = _MIMEMultipart_wu("alternative")
                msg["Subject"] = subject
                msg["From"]    = f"{from_name} <{from_email}>" if from_name else from_email
                msg["To"]      = to_email
                msg.attach(_MIMEText_wu(body, "plain"))
                with _smtp_wu.SMTP(smtp_host, smtp_port, timeout=15) as srv:
                    srv.ehlo()
                    srv.starttls()
                    srv.login(smtp["smtp_user"], smtp["smtp_pass"])
                    srv.sendmail(from_email, to_email, msg.as_string())
                sent_count += 1
                # Log the warmup send
                supabase.table("warmup_logs").insert({
                    "user_id":  user_id,
                    "to_email": to_email,
                    "subject":  subject,
                    "day":      day,
                }).execute()
            except Exception as e:
                errors.append(str(e))

        # Update daily_target in config
        supabase.table("warmup_configs").update({"daily_target": daily_target}).eq("user_id", user_id).execute()
        results.append({"user_id": user_id, "day": day, "target": daily_target, "sent": sent_count, "errors": errors})

    return {"ok": True, "results": results}
