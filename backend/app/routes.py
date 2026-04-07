from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
from .models import LeadCreate, LeadUpdate, CompanyCreate, CompanyUpdate, UserSignup, UserLogin, ICPCreate, ICPUpdate, PersonaCreate, PersonaUpdate, LeadStarUpdate, LeadConnectionStatusUpdate, LeadSpreadsheetUpdate
from .database import supabase

router = APIRouter()

# ─── AUTH ROUTES ────────────────────────────────────────────

@router.post("/auth/signup")
async def signup(user: UserSignup):
    try:
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password
        })
        if response.user:
            # Create profile record
            supabase.table("profiles").insert({
                "id": response.user.id,
                "email": user.email,
                "full_name": user.full_name or ""
            }).execute()
        return {"message": "Signup successful. Check your email to confirm."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/login")
async def login(user: UserLogin):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        return {
            "access_token": response.session.access_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


# ─── HELPER: get user id from token ─────────────────────────

def get_user_id(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
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
    user_id = get_user_id(authorization)
    try:
        supabase.table("leads")\
            .delete()\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
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
        return {"profile": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/icp/{profile_id}")
async def update_icp_profile(
    profile_id: str,
    profile: ICPUpdate,
    authorization: str = Header(...)
):
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
            supabase.table("leads").update(update_data).eq("id", lead_id).execute()
            updated_lead = {**lead, **update_data}
            return {"lead": updated_lead, "enriched": True, "message": "Email found via Hunter"}

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
    user_id = get_user_id(authorization)
    try:
        update_data = {k: v for k, v in data.dict().items() if v is not None}
        response = supabase.table("leads")\
            .update(update_data)\
            .eq("id", lead_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"lead": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── COMPANY UPDATE ───────────────────────────────────────────

@router.patch("/companies/{company_id}")
async def update_company(
    company_id: str,
    data: CompanyUpdate,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    try:
        update_data = {k: v for k, v in data.dict().items() if v is not None}
        response = supabase.table("companies")\
            .update(update_data)\
            .eq("id", company_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"company": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    try:
        supabase.table("companies")\
            .delete()\
            .eq("id", company_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"message": "Company deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/{company_id}/leads")
async def get_company_leads(
    company_id: str,
    authorization: str = Header(...)
):
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
    skipped = 0

    for company in companies:
        try:
            if not company.get("name"):
                skipped += 1
                continue

            # Check for duplicates by name
            existing = supabase.table("companies")\
                .select("id")\
                .eq("user_id", user_id)\
                .eq("name", company["name"])\
                .execute()

            if existing.data:
                skipped += 1
                continue

            data = {
                "user_id": user_id,
                "name": company.get("name", "").strip(),
                "industry": company.get("industry") or None,
                "size": company.get("size") or None,
                "headquarters": company.get("headquarters") or None,
                "description": company.get("description") or None,
                "website": company.get("website") or None,
                "linkedin_url": company.get("linkedinUrl") or company.get("salesNavUrl") or None,
            }

            response = supabase.table("companies").insert(data).execute()
            inserted.append(response.data[0])

        except Exception as e:
            print(f"Company insert error: {e}")
            skipped += 1
            continue

    return {
        "inserted": len(inserted),
        "skipped": skipped,
        "companies": inserted
    }

# ─── COMPLIANCE CHECKER ───────────────────────────────────────

@router.post("/companies/{company_id}/check-compliance")
async def check_compliance(
    company_id: str,
    payload: dict = {},
    authorization: str = Header(...)
):
    user_id = get_user_id(authorization)
    try:
        co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
        if not co_res.data:
            raise HTTPException(status_code=404, detail="Company not found")
        company = co_res.data[0]

        groq_key = payload.get("groq_key") or os.getenv("GROQ_API_KEY", "")
        gemini_key = payload.get("gemini_key") or os.getenv("GEMINI_API_KEY", "")
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
        if (groq_key or gemini_key) and company.get("name"):
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
                if gemini_key:
                    res = requests.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}',
                        headers={'Content-Type': 'application/json'},
                        json={'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 200}},
                        timeout=15
                    )
                    data = res.json()
                    content = data['candidates'][0]['content']['parts'][0]['text'].strip()
                else:
                    res = requests.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'},
                        json={'model': 'llama-3.1-8b-instant', 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': 200, 'temperature': 0.1},
                        timeout=10
                    )
                    data = res.json()
                    content = data['choices'][0]['message']['content'].strip()

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
            supabase.table("companies").update({"compliance": compliance_str}).eq("id", company_id).execute()

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
                    .execute()

                results.append({
                    "lead_id": lead_id,
                    "updated": list(update_data.keys()),
                    "data": update_data
                })

            except Exception as e:
                print(f"Error processing lead {lead.get('id')}: {e}")
                continue

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
    user_id = get_user_id(authorization)
    try:
        co_res = supabase.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).execute()
        if not co_res.data:
            raise HTTPException(status_code=404, detail="Company not found")
        company = co_res.data[0]

        from .website_analyzer import fetch_website_content, analyze_with_gemini, analyze_with_openai, analyze_with_groq, classify_with_groq

        openai_key = payload.get("openai_key") or os.getenv("OPENAI_API_KEY", "")
        gemini_key = payload.get("gemini_key") or os.getenv("GEMINI_API_KEY", "")
        groq_key = payload.get("groq_key") or os.getenv("GROQ_API_KEY", "")
        website = company.get("website") or payload.get("website", "")

        result = {}

        # Fetch website content first if URL available
        website_data = None
        if website:
            website_data = fetch_website_content(website)

        # Try AI in priority order: Gemini → OpenAI → Groq
        if website_data and gemini_key:
            result = analyze_with_gemini(website_data, company.get("name", ""), gemini_key)
        
        if not result and website_data and openai_key:
            ai_result = analyze_with_openai(website_data, company.get("name", ""), openai_key)
            if not ai_result.get('_openai_error'):
                result = ai_result

        if not result and groq_key:
            result = analyze_with_groq(
                website_data,
                company.get("name", ""),
                company.get("industry", ""),
                company.get("description", ""),
                groq_key
            )

        if not result:
            raise HTTPException(status_code=400, detail="No AI key available. Add Gemini (free), OpenAI, or Groq key in Settings.")

        # Save results to database
        if result and not result.get("error"):
            update_data = {}
            if result.get("company_type"):
                update_data["classification"] = result["company_type"]
            if result.get("compliance"):
                update_data["compliance"] = ", ".join(result["compliance"])
            if update_data:
                supabase.table("companies").update(update_data).eq("id", company_id).execute()

        return {"success": True, "analysis": result, "company_id": company_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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

            # Only check duplicates if profile_url exists and is not empty
            if profile_url and len(profile_url) > 10:
                existing = supabase.table("leads")\
                    .select("id")\
                    .eq("user_id", user_id)\
                    .eq("profile_url", profile_url)\
                    .execute()
                if existing.data:
                    skipped += 1
                    continue

            # Skip if no name
            if not lead.get("name") or not lead["name"].strip():
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
            print(f"Lead insert error: {e}")
            skipped += 1
            continue

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


