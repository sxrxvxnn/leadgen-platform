from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re

class LeadCreate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    profile_url: Optional[str] = None
    status: Optional[str] = "new"
    notes: Optional[str] = None
    scraped_at: Optional[datetime] = None
    about: Optional[str] = None
    experience: Optional[list] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    about: Optional[str] = None
    experience: Optional[list] = None

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    size: Optional[str] = None
    website: Optional[str] = None
    headquarters: Optional[str] = None
    description: Optional[str] = None
    linkedin_url: Optional[str] = None
    followers: Optional[str] = None

class UserSignup(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

    @field_validator('email')
    @classmethod
    def normalise_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email address')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append('at least 8 characters')
        if not re.search(r'[A-Z]', v):
            errors.append('one uppercase letter')
        if not re.search(r'[a-z]', v):
            errors.append('one lowercase letter')
        if not re.search(r'[0-9]', v):
            errors.append('one digit')
        if errors:
            raise ValueError('Password must contain ' + ', '.join(errors))
        return v


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class PasswordResetRequest(BaseModel):
    email: str

    @field_validator('email')
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class PasswordResetConfirm(BaseModel):
    recovery_token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append('at least 8 characters')
        if not re.search(r'[A-Z]', v):
            errors.append('one uppercase letter')
        if not re.search(r'[a-z]', v):
            errors.append('one lowercase letter')
        if not re.search(r'[0-9]', v):
            errors.append('one digit')
        if errors:
            raise ValueError('Password must contain ' + ', '.join(errors))
        return v

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

class CompanyUpdate(BaseModel):
    classification: Optional[str] = None
    prospect_status: Optional[str] = None
    employee_count: Optional[str] = None
    followers: Optional[str] = None
    revenue: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = None
    headquarters: Optional[str] = None
    description: Optional[str] = None
    linkedin_url: Optional[str] = None
    linkedin_website: Optional[str] = None
    phone: Optional[str] = None
    founded: Optional[str] = None
    specialties: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    company_type: Optional[str] = None
    compliance: Optional[str] = None
    is_saas: Optional[bool] = None
    name: Optional[str] = None
    tagline: Optional[str] = None