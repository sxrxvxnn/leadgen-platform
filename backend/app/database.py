from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL         = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY    = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment")

if not SUPABASE_ANON_KEY:
    raise ValueError("Missing SUPABASE_ANON_KEY in environment — required for auth operations")

# ── Admin / data client (service role) ────────────────────────────────────────
# Bypasses RLS. Use ONLY for server-side data operations, never for auth flows.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
supabase.postgrest.auth(SUPABASE_SERVICE_KEY)

# ── Auth client (anon key) ────────────────────────────────────────────────────
# Used for all auth operations (login, signup, refresh, password reset).
# Respects Supabase auth policies (email confirmation, rate limits, etc.).
supabase_auth: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
