<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the LeadGen Engine FastAPI backend. PostHog is initialised in the application lifespan (`backend/app/main.py`) using environment variables, and 14 business-critical events are captured across authentication, lead management, company management, ICP profiles, email enrichment, AI-powered autofill, compliance checking, and website analysis.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | New user completes email registration | `backend/app/routes.py` |
| `user_logged_in` | User successfully authenticates with password | `backend/app/routes.py` |
| `lead_created` | Single lead manually added | `backend/app/routes.py` |
| `lead_deleted` | Lead removed | `backend/app/routes.py` |
| `lead_enriched` | Single lead email enriched via Hunter (success + failed) | `backend/app/routes.py` |
| `leads_bulk_imported` | Leads bulk imported from browser extension | `backend/app/routes.py` |
| `leads_bulk_enriched` | Bulk email enrichment completes | `backend/app/routes.py` |
| `leads_autofill_completed` | Bulk AI autofill (website, revenue, org size) finishes a batch | `backend/app/routes.py` |
| `company_created` | Single company record created | `backend/app/routes.py` |
| `company_deleted` | Company removed | `backend/app/routes.py` |
| `companies_bulk_created` | Companies bulk imported | `backend/app/routes.py` |
| `icp_profile_created` | Ideal Customer Profile created | `backend/app/routes.py` |
| `company_website_analyzed` | AI analysis of a company website completes | `backend/app/routes.py` |
| `company_compliance_checked` | Compliance check runs on a company | `backend/app/routes.py` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/465205/dashboard/1697621)
- [New User Signups (Last 30 days)](https://us.posthog.com/project/465205/insights/Ine1aeRi)
- [Lead Pipeline Activity (Last 30 days)](https://us.posthog.com/project/465205/insights/dxmP5rgc)
- [User Onboarding Funnel](https://us.posthog.com/project/465205/insights/tq2XhnKs)
- [AI Feature Usage (Last 30 days)](https://us.posthog.com/project/465205/insights/FNT21B9c)
- [Lead Enrichment Success Rate (Last 30 days)](https://us.posthog.com/project/465205/insights/k3fGjoo6)

> **Note:** The `posthog` package could not be installed automatically due to sandbox network restrictions. Run `pip install -r requirements.txt` (or `pip install posthog`) inside `backend/` before starting the server.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
