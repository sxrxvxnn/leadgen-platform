from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
import os
from .routes import router

load_dotenv()

app = FastAPI(
    title="LeadGen Engine API",
    description="Backend API for LeadGen Engine",
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True}
)

# Security scheme — adds Authorize button to docs
security = HTTPBearer()

# CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "LeadGen Engine API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}