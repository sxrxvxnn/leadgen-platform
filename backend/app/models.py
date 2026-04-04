from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LeadCreate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    profile_url: Optional[str] = None
    status: Optional[str] = "new"
    notes: Optional[str] = None
    scraped_at: Optional[datetime] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    size: Optional[str] = None
    website: Optional[str] = None
    headquarters: Optional[str] = None
    description: Optional[str] = None
    linkedin_url: Optional[str] = None

class UserSignup(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class ICPCreate(BaseModel):
    company_name: str
    industry: Optional[str] = None
    company_size: Optional[str] = None
    headquarters: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    target_roles: Optional[list] = []
    pain_points: Optional[list] = []
    tech_stack: Optional[list] = []
    fit_score: Optional[int] = 0
    fit_reason: Optional[str] = None
    notes: Optional[str] = None
    company_id: Optional[str] = None

class ICPUpdate(BaseModel):
    target_roles: Optional[list] = None
    pain_points: Optional[list] = None
    tech_stack: Optional[list] = None
    fit_score: Optional[int] = None
    fit_reason: Optional[str] = None
    notes: Optional[str] = None

class PersonaCreate(BaseModel):
    name: str
    filters: Optional[dict] = {}

class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    filters: Optional[dict] = None

class LeadStarUpdate(BaseModel):
    starred: bool

class LeadConnectionStatusUpdate(BaseModel):
    connection_status: str

class LeadSpreadsheetUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    profile_url: Optional[str] = None
    employee_count: Optional[str] = None
    org_size: Optional[str] = None
    website: Optional[str] = None
    followers_count: Optional[str] = None
    revenue: Optional[str] = None
    has_security_team: Optional[str] = None
    compliance: Optional[str] = None
    account_manager: Optional[str] = None
    linkedin_status_rahul: Optional[str] = None
    linkedin_status_rejah: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    remarks: Optional[str] = None