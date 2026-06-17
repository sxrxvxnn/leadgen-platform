import logging
import threading as _threading_mod
import requests
from urllib.parse import urlparse
logger = logging.getLogger(__name__)

# Cap concurrent DDGS calls to 3 — prevents DuckDuckGo rate-limiting during bulk autofill
_DDGS_SEM = _threading_mod.Semaphore(3)
from fastapi import APIRouter, HTTPException, Header, Request
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


@router.get("/leads/by-profile-url")
async def get_lead_by_profile_url(url: str, authorization: str = Header(...)):
    """Used by the Chrome extension to check if a LinkedIn profile is already a lead."""
    user_id = get_user_id(authorization)
    try:
        clean = url.split('?')[0].split('#')[0].rstrip('/')
        res = supabase.table("leads")\
            .select("id, name, title, company")\
            .eq("user_id", user_id)\
            .eq("profile_url", clean)\
            .limit(1)\
            .execute()
        if res.data:
            return {"lead": res.data[0]}
        # Also try with trailing slash variant
        res2 = supabase.table("leads")\
            .select("id, name, title, company")\
            .eq("user_id", user_id)\
            .eq("profile_url", clean + "/")\
            .limit(1)\
            .execute()
        if res2.data:
            return {"lead": res2.data[0]}
        return {"lead": None}
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
        return {"lead": response.data[0]}
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


# ─── COMPANIES ROUTES ────────────────────────────────────────

@router.get("/companies")
async def get_companies(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    try:
        response = supabase.table("companies")\
            .select("*")\
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

        hunter_key = payload.get("hunter_key") or os.getenv("HUNTER_API_KEY", "")
        apollo_key = payload.get("apollo_key") or os.getenv("APOLLO_API_KEY", "")

        name = lead.get("name", "")
        company = lead.get("company", "")
        website = lead.get("website", "")

        # Try to get website from companies table if not on lead
        if not website and company:
            try:
                co_res = supabase.table("companies")\
                    .select("website")\
                    .eq("user_id", user_id)\
                    .ilike("name", company)\
                    .execute()
                if co_res.data and co_res.data[0].get("website"):
                    website = co_res.data[0]["website"]
            except Exception:
                pass

        from .enrichment import enrich_lead, extract_domain
        result = {}

        # Try Hunter with domain
        if hunter_key and website:
            domain = extract_domain(website)
            parts = name.strip().split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
            from .enrichment import enrich_with_hunter
            result = enrich_with_hunter(first_name, last_name, domain)

        if result.get("email"):
            update_data = {"email": result["email"]}
            supabase.table("leads").update(update_data).eq("id", lead_id).eq("user_id", user_id).execute()
            updated_lead = {**lead, **update_data}
            posthog.capture(user_id, "lead_enriched", {"source": "hunter", "success": True})
            return {"lead": updated_lead, "enriched": True, "message": "Email found via Hunter"}

        posthog.capture(user_id, "lead_enriched", {"source": "hunter", "success": False})
        return {
            "lead": lead,
            "enriched": False,
            "message": "Email not found. Try adding the company website first using Auto-fill."
        }

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

    from .company_prefill import (
        search_company_website, extract_linkedin_url_from_html,
        extract_linkedin_url_with_qwen3, scrape_linkedin_data,
        search_linkedin_url_direct,
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

    # Fallback 1: DDGS search for LinkedIn URL by company name
    if not linkedin_url:
        try:
            linkedin_url = search_linkedin_url_direct(name)
            if linkedin_url:
                print(f"LinkedIn URL found via DDGS for {name}: {linkedin_url}")
        except Exception as e:
            print(f"DDGS LinkedIn fallback error: {e}")

    # Fallback 2: Apollo.io organization enrichment by domain
    if not linkedin_url:
        try:
            apollo_key = os.getenv("APOLLO_API_KEY", "")
            domain = urlparse(url).netloc.replace("www.", "")
            if apollo_key and domain:
                apollo_res = requests.post(
                    "https://api.apollo.io/api/v1/organizations/enrich",
                    json={"api_key": apollo_key, "domain": domain},
                    timeout=10,
                )
                if apollo_res.status_code == 200:
                    org = apollo_res.json().get("organization") or {}
                    li = org.get("linkedin_url") or ""
                    if li and "linkedin.com/company/" in li:
                        linkedin_url = li if li.startswith("http") else "https://" + li
                        print(f"LinkedIn URL found via Apollo for {name}: {linkedin_url}")
        except Exception as e:
            print(f"Apollo LinkedIn fallback error: {e}")

    # Fallback 3: Guess slug from domain (e.g. sequantix.com → /company/sequantix)
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

    return {
        "name": name,
        "website_url": website_url,
        "linkedin_url": linkedin_url,
        "linkedin_people_url": linkedin_people_url,
        "message": "LinkedIn URL found" if linkedin_url else "LinkedIn URL not found on website. Provide it manually.",
        "linkedin_data": linkedin_data,
    }


# ─── PEOPLE SEARCH (Hunter + DDGS fallback) ──────────────────────────────────────

def _hunter_domain_search(domain: str, roles: list) -> list:
    """Search Hunter.io domain-search for people at a company domain."""
    hunter_key = os.getenv("HUNTER_API_KEY", "")
    if not hunter_key or not domain:
        return []

    clean_domain = domain.replace("https://", "").replace("http://", "").split("/")[0].strip()
    params = {"domain": clean_domain, "api_key": hunter_key, "limit": 100, "type": "personal"}
    try:
        res = requests.get("https://api.hunter.io/v2/domain-search", params=params, timeout=12)
        if res.status_code != 200:
            print(f"Hunter domain-search returned {res.status_code}: {res.text[:200]}")
            return []
        emails = res.json().get("data", {}).get("emails") or []
        people = []
        for e in emails:
            first = e.get("first_name") or ""
            last  = e.get("last_name") or ""
            title = e.get("position") or ""
            # filter by role if specified
            if roles:
                title_lower = title.lower()
                if not any(r.lower() in title_lower for r in roles):
                    continue
            people.append({
                "first_name":   first,
                "last_name":    last,
                "name":         f"{first} {last}".strip(),
                "title":        title,
                "company":      e.get("company") or "",
                "location":     "",
                "linkedin_url": e.get("linkedin") or "",
                "email":        e.get("value") or "",
                "photo_url":    "",
                "confidence":   e.get("confidence") or 0,
            })
        return people
    except Exception as ex:
        print(f"Hunter domain-search error: {ex}")
        return []


def _ddgs_linkedin_search(company_name: str, roles: list) -> list:
    """Use DuckDuckGo to find LinkedIn profiles of people at a company."""
    try:
        from ddgs import DDGS
    except ImportError:
        return []

    queries = []
    if roles:
        for role in roles[:4]:  # cap to avoid too many queries
            queries.append(f'site:linkedin.com/in/ "{company_name}" "{role}"')
    else:
        queries.append(f'site:linkedin.com/in/ "{company_name}"')

    seen_urls = set()
    people = []

    try:
        with DDGS() as ddgs:
            for q in queries:
                try:
                    for r in ddgs.text(q, max_results=8):
                        url = r.get("href", "")
                        if "linkedin.com/in/" not in url:
                            continue
                        # normalise URL
                        clean_url = url.split("?")[0].rstrip("/")
                        if clean_url in seen_urls:
                            continue
                        seen_urls.add(clean_url)

                        title_text = r.get("title", "")
                        body_text  = r.get("body", "")

                        # parse "First Last - Title - Company | LinkedIn"
                        name, title = "", ""
                        if " - " in title_text:
                            parts = [p.strip() for p in title_text.split(" - ")]
                            name  = parts[0]
                            title = parts[1] if len(parts) > 1 else ""
                        else:
                            name = title_text.split("|")[0].strip()

                        # strip "| LinkedIn" suffix
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
                except Exception:
                    continue
    except Exception as ex:
        print(f"DDGS people search error: {ex}")

    return people


@router.post("/companies/people-search")
async def search_company_people(payload: dict, authorization: str = Header(...)):
    """Find people at a company — Hunter domain search first, DDGS LinkedIn fallback."""
    get_user_id(authorization)

    company_name = (payload.get("company_name") or "").strip()
    domain       = (payload.get("domain") or "").strip()
    roles        = payload.get("roles") or []

    if not company_name and not domain:
        raise HTTPException(status_code=400, detail="company_name or domain required")

    # 1. Hunter domain search (structured, has emails + LinkedIn)
    people = _hunter_domain_search(domain, roles) if domain else []

    # 2. DDGS LinkedIn search as fallback / supplement
    if len(people) < 5:
        ddgs_people = _ddgs_linkedin_search(company_name, roles)
        # merge — deduplicate by linkedin_url
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
                    if not linkedin_url and openrouter_key:
                        linkedin_url = extract_linkedin_url_with_qwen3(r.text, company_name, openrouter_key)
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

        # (c) Name-based search — last resort, most likely to match wrong entity
        if not linkedin_url:
            linkedin_url = search_linkedin_url_direct(search_name) or ""

        if not linkedin_url:
            return {"success": False, "filled": [], "update": {}, "linkedin_url": None,
                    "message": "Could not find a LinkedIn page for this company. Try adding the LinkedIn URL manually on the card."}

        # Step 2 — Scrape LinkedIn
        li = scrape_linkedin_data(linkedin_url, li_cookie=li_cookie)

        # If LinkedIn was blocked, try DDGS snippet fallback
        if not any([li.get("followers"), li.get("employee_count"), li.get("description")]):
            try:
                from ddgs import DDGS
                with DDGS() as ddgs:
                    q = f'"{company_name}" linkedin followers employees'
                    for sr in ddgs.text(q, max_results=5):
                        body = sr.get("body", "")
                        if not li.get("followers"):
                            import re as _re2
                            m = _re2.search(r'([\d,]+)\s*followers', body, _re2.I)
                            if m: li["followers"] = m.group(0).strip()
                        if not li.get("description") and len(body) > 40:
                            li["description"] = body[:280]
                        if li.get("followers") and li.get("description"): break
            except Exception:
                pass

        # Step 3 — Website: prefer stored website over LinkedIn-scraped to avoid aggregator sites
        # (e.g. LinkedIn page for SS&C shows ampliz.com, but stored website ssctech.com is correct)
        if not is_indian and not found_website and not li.get("website"):
            found_website = search_company_website(company_name) or ""
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


# ─── BULK AUTOFILL (parallel) ─────────────────────────────────

@router.post("/companies/bulk-autofill")
async def bulk_autofill_companies(
    payload: dict = {},
    authorization: str = Header(...)
):
    """Autofill data for multiple companies in parallel (20 workers)."""
    user_id = get_user_id(authorization)
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

                    # Industry → classification (if not already set)
                    if li_data.get("industry") and not company.get("classification") or company.get("classification") == "Unclassified":
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
                        ind_lower = li_data["industry"].lower()
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
        "id,email,full_name,mode,role,team_id,onboarding_complete"
    ).eq("id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data


@router.post("/profile/setup")
async def setup_profile(payload: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    mode = payload.get("mode")
    if mode not in ("solo", "team"):
        raise HTTPException(status_code=422, detail="mode must be 'solo' or 'team'")

    update: dict = {"mode": mode, "onboarding_complete": True}

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
    res = supabase.table("profiles").select("role,team_id").eq("id", user_id).single().execute()
    if not res.data or res.data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    team_id = res.data.get("team_id")
    if not team_id:
        raise HTTPException(status_code=403, detail="Not part of a team")
    return team_id


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
