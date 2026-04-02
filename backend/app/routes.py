from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from .models import LeadCreate, LeadUpdate, CompanyCreate, UserSignup, UserLogin
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
            if lead.get("scraped_at"):
                pass  # already a string from extension
            # Check for duplicates
            if lead.get("profile_url"):
                existing = supabase.table("leads")\
                    .select("id")\
                    .eq("user_id", user_id)\
                    .eq("profile_url", lead["profile_url"])\
                    .execute()
                if existing.data:
                    skipped += 1
                    continue
            response = supabase.table("leads").insert(lead).execute()
            inserted.append(response.data[0])
        except Exception:
            skipped += 1
            continue

    return {
        "inserted": len(inserted),
        "skipped": skipped,
        "leads": inserted
    }