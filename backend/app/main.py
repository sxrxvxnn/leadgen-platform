from .instrumentation import setup_logging
from contextlib import asynccontextmanager

import posthog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
import os
from .routes import router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    posthog.api_key = os.getenv("POSTHOG_PROJECT_TOKEN", "")
    posthog.host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
    posthog.enable_exception_autocapture = True
    yield
    posthog.flush()


app = FastAPI(
    title="LeadGen Engine API",
    description="Backend API for LeadGen Engine",
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True},
    lifespan=lifespan,
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