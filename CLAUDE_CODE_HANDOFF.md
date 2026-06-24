# LeadGen Engine — Project Handoff for Claude Code

## PROJECT OVERVIEW
LeadGen Engine is a LinkedIn lead-generation SaaS built for Beagle Security's outreach team (Rahul, Rejah). It scrapes LinkedIn companies/people via a Chrome extension, stores data in Supabase, and provides a React dashboard for managing leads, companies, and outreach.

## STACK & PATHS
- Frontend: React + Vite + pnpm @ ~/leadgen-platform/dashboard/
- Backend: FastAPI + Supabase + Python (venv) @ ~/leadgen-platform/backend/
- Extension: Chrome MV3 @ ~/leadgen-platform/extension/
- DB: Supabase (project: gzvrjsacjjalfrjmozjp)
- GitHub: https://github.com/sxrxvxnn/leadgen-platform.git (main branch)

## RUNNING LOCALLY
```bash
# Backend
cd ~/leadgen-platform/backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Frontend
cd ~/leadgen-platform/dashboard && pnpm dev
# → http://localhost:5173

# Extension: chrome://extensions → reload "LeadGen Engine" → sign in
```

Login: aathmaj.riyadh@gmail.com / Shravan@192004 (PLEASE CHANGE THIS — shared in plaintext during dev)

## ✅ FULLY WORKING FEATURES

**Extension**: login w/ token refresh, company search scraping, people-page scraping, profile scraping (name/title/company/location/followers/appointment detection), auto-scroll, Sales Nav detection, duplicate detection.

**Companies page** (dashboard/src/pages/Companies.jsx):
- Company cards with classification dropdown, editable website field (inline edit)
- Follower/type/status filters
- AI website analyzer using Gemini (backend/app/website_analyzer.py) — detects Product/Services/Hybrid classification, login module, compliance badges (ISO27001/SOC2/GDPR/HIPAA/PCI/OWASP/CERT-In), is_saas, target_market
- Bulk select + bulk delete (checkboxes on each card + select-all)
- Batch DM Finder (dashboard/src/components/DMFinder.jsx) — queue of company LinkedIn people-page URLs, manual click-through workflow with progress tracking (pending/opened/done), since LinkedIn blocks automation

**Leads page**: full table, star/favorite, 11-stage connection_status, DM/SEC badges, bulk actions, CSV export, Hunter.io enrichment

**SpreadsheetView** (dashboard/src/components/SpreadsheetView.jsx): 21 resizable columns, inline edit, view filters (All/Decision Makers/Security/Starred), CSV export

**ICP page** (dashboard/src/pages/ICP.jsx): lead-matching tool — left panel filters (DM titles, org size, security team, location), right panel shows matched leads + match rate + DM count, save/load named ICPs to localStorage

**Settings page**: API key fields for Gemini (primary, free, recommended — aistudio.google.com), OpenAI (GPT-4o fallback), Groq (Llama fallback, console.groq.com), Hunter, Apollo — stored in localStorage

**Backend routes** (backend/app/routes.py):
- /companies/{id}/analyze-website — Gemini → OpenAI → Groq priority chain for website analysis
- /companies/{id}/check-compliance — scrapes website via fetch_website_content() then verifies with AI
- /leads/autofill-bulk — batch enrichment (SEE BUG BELOW)
- /health endpoint for Railway

**PostHog**: Event tracking (posthog==3.x, downgraded from 7.x which broke auth — DO NOT upgrade past v3 without rewriting all posthog.capture/identify calls in routes.py to new client API). OTel logging integration in backend/app/instrumentation.py sends logs to PostHog.

## ❌ KNOWN BUGS / OPEN ISSUES

### 1. Auto-fill returns "Done — 0 leads updated"
- Backend route /leads/autofill-bulk WORKS when tested directly via curl with a hardcoded Gemini key (confirmed — returns has_security_team, employee_count, org_size, followers_count correctly)
- Frontend SpreadsheetView.jsx handleAutofill was rewritten multiple times to use direct fetch() with gemini_api_key from localStorage('geminiKey')
- The guard check `if (!groqKey && !openaiKey && !geminiKey2)` was fixed
- BUT autofill in the UI still shows 0 updated — root cause NOT YET FOUND. Need to add console.log debugging in the browser to see what the actual API response looks like vs what the backend curl test returns. Possibly a response parsing mismatch (data.results vs res.data.results) or the request body isn't matching what backend expects.
- ACTION: Open browser DevTools Network tab, click Autofill, inspect the actual /leads/autofill-bulk request payload and response, compare against working curl test.

### 2. Compliance checker shows "None detected" for some companies
- Beagle Security works correctly (shows ISO 27001, OWASP, Security Team: Yes) — confirmed via screenshot
- Neura Health and Culina Health show "Certifications: None detected, Security Team: Unknown" even though their company cards already display compliance badges (ISO 27001, SOC 2, HIPAA, GDPR) from a PREVIOUS analysis stored in DB
- Root cause: the live website scrape (fetch_website_content in website_analyzer.py) + Gemini verification is being too conservative on re-check, not finding the same compliance text the earlier full website analyzer found
- ACTION: Compare check-compliance route logic vs analyze-website route logic — analyze-website found ISO27001/SOC2/HIPAA/GDPR for these companies before, but check-compliance route's scraping/prompt isn't finding it. May need to use the SAME fetch_website_content + same compliance keyword detection for both routes.

### 3. Followers count inaccurate
- Autofill returns followers_count like "1,695" but this may be personal LinkedIn followers of a scraped lead, not the COMPANY's LinkedIn page followers
- Need to verify data source — should come from company LinkedIn page scrape, not individual profile

### 4. Employee count slightly off
- Autofill returned employee_count: 52 vs actual LinkedIn "49 associated members" for Beagle Security
- AI estimation vs actual LinkedIn data — consider using extension-scraped company size as source of truth instead of AI guess

## 🚧 NOT YET DONE

### Deployment (paused)
- requirements.txt generated (60+ packages incl. opentelemetry, posthog==3.x) ✅
- Procfile created: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT` ✅
- railway.json created ✅
- /api/health endpoint added ✅
- dashboard/vercel.json created ✅
- dashboard/.env.production created (placeholder VITE_API_URL) ✅
- GitHub repo pushed (sxrxvxnn/leadgen-platform, main) ✅
- PENDING: Deploy backend to Railway (railway.app → New Project → Deploy from GitHub → root=backend → add env vars from backend/.env including SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_KEY/SECRET_KEY/GROQ_API_KEY/GEMINI_API_KEY/POSTHOG_PROJECT_TOKEN/POSTHOG_LOGS_TOKEN)
- PENDING: Deploy frontend to Vercel (root=dashboard, env var VITE_API_URL=<railway-url>/api)
- PENDING: Update extension/popup.js `const API = 'http://localhost:8000/api'` → production Railway URL after deploy

### Activity Log (partially built, not wired)
- ActivityLog.jsx component exists in dashboard/src/components/ — modal for logging outreach actions (Connection Request Sent, Follow-ups, Reply Received, etc.)
- Backend routes /leads/{id}/activity (POST/GET) need to be added to routes.py
- Supabase table SQL needed (run in SQL editor):
```sql
create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  lead_id uuid references leads(id) on delete cascade,
  action text not null,
  notes text,
  created_at timestamp with time zone default now()
);
alter table activity_log enable row level security;
create policy "Users manage own activity" on activity_log for all using (auth.uid() = user_id);
```
- api.js needs addActivity/getActivity exports
- Leads.jsx needs "Activity" button wired to open ActivityLog modal per lead

### Company Fit Score (built but not integrated)
- fitScore.js utility created in dashboard/src/utils/ — calculates 0-10 "fit score" for Beagle Security ICP:
  - Product company +3, has_login +2, 51-500 employees +2, US/EU/SG/AU HQ +2, security team +1
  - Returns Hot/Warm/Cold/Poor Fit labels with colors
- NOT YET integrated into Companies.jsx cards or filters

### Live LinkedIn data
- Proxycurl shut down (illegal per user research)
- Apollo free tier too limited (403 errors)
- RocketReach not yet evaluated
- Current approach: extension scrapes when team visits LinkedIn pages — this remains the primary data source

## ❌ EXPLICITLY DEPRIORITIZED (don't build unless asked)
- Email templates
- Proxycurl-based live data

## TEAM'S MANUAL WORKFLOW (what we're automating)
1. Filter LinkedIn companies (51-200 employees, US HQ, 5K+ followers, target industry)
2. Manually check each company's website — product vs services, compliance, fit for Beagle Security
3. Shortlist good fits → fill ICP details manually
4. Find decision makers (CEO/CTO/CISO/VP Eng etc.) based on company headcount — varies by size
5. Check each lead's profile + past experience
6. Fill ICP from extracted lead data
7. Fetch email via Apollo

The platform should automate steps 1-2 (Companies + website analyzer + fit score), 3-4 (ICP page + DM Finder), 5-6 (lead profile data + spreadsheet autofill), 7 (Hunter enrichment).

## SUGGESTED NEXT STEPS (in priority order)
1. Fix autofill (debug via browser Network tab as described above)
2. Fix compliance checker consistency
3. Wire up Activity Log (table + routes + UI)
4. Integrate Fit Score into Companies page
5. Deploy to Railway + Vercel
6. Update extension API URL to production
