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