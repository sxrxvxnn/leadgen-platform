from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing Supabase credentials in .env file")

# Service client — used for admin operations in backend
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
# supabase-py v2 sets apikey header but not Authorization on PostgREST by default
# Without this, PostgREST treats requests as anon and RLS blocks inserts
supabase.postgrest.auth(SUPABASE_SERVICE_KEY)