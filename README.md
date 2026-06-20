# Sonar — B2B Lead Intelligence Platform

> Find, enrich, and score companies against your ideal customer profile.

**Live site:** [sonarleads.vercel.app](https://sonarleads.vercel.app)

---

## What is this project?

Sonar helps sales teams discover B2B companies, auto-fill their data (website, LinkedIn, emails, headcount), and score them against a custom ICP (Ideal Customer Profile). Think of it as a smart company database that keeps itself updated.

---

## Tech Stack (plain English)

| Layer | What we use | What it does |
|---|---|---|
| Frontend | React + Vite | The dashboard and landing page (what users see) |
| Styling | Inline CSS styles | No Tailwind — we write styles directly in JSX |
| Animations | `motion/react` | Smooth animations on the UI |
| Backend | FastAPI (Python) | The API server — handles enrichment, ICP scoring |
| Database | Supabase (PostgreSQL) | Stores companies, leads, user data |
| Hosting | Vercel | Auto-deploys when we push to `main` |
| Auth | Supabase Auth | Login, signup, password reset |

---

## Folder Structure

```
leadgen-platform/
├── dashboard/              ← React frontend (Vite)
│   ├── src/
│   │   ├── pages/          ← Full page components (Landing, Dashboard, Companies…)
│   │   ├── components/     ← Reusable UI components
│   │   │   └── ui/         ← Aceternity-style animated components
│   │   └── App.jsx         ← Routes
│   └── public/             ← Static files (images, screenshots)
│
├── backend/                ← FastAPI Python server
│   └── app/
│       ├── main.py         ← API entry point
│       ├── routers/        ← API route files (companies, leads, icp…)
│       └── services/       ← Business logic (enrichment, scoring)
│
└── .github/workflows/      ← GitHub Actions (Discord notifications)
```

---

## How to Run Locally

### Frontend
```bash
cd dashboard
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# API runs at http://localhost:8000
```

You will need a `.env` file in `dashboard/` — ask the team lead for the values.

---

## How We Work (Git Workflow)

**Never push directly to `main`.** Always use a branch + Pull Request.

```bash
# 1. Make sure you're on main and up to date
git checkout main
git pull

# 2. Create your branch (use your name or the feature)
git checkout -b your-name/feature-name
# e.g. git checkout -b priya/fix-login-button

# 3. Make your changes, then commit
git add .
git commit -m "fix: login button not responding on mobile"

# 4. Push your branch
git push origin your-name/feature-name

# 5. Open a Pull Request on GitHub and ask for review
```

### Commit message format
```
feat: add export to CSV button          new feature
fix: company card showing wrong logo    bug fix
style: update button color to red       visual / CSS only
docs: update README setup steps         documentation
```

---

## Areas of the App

| Area | Files | Description |
|---|---|---|
| Landing page | `dashboard/src/pages/Landing.jsx` | Marketing site at sonarleads.vercel.app |
| Dashboard | `dashboard/src/pages/Dashboard.jsx` | Main app after login |
| Companies | `dashboard/src/pages/Companies.jsx` | Company list and cards |
| ICP Settings | `dashboard/src/pages/ICP.jsx` | Ideal Customer Profile config |
| UI Components | `dashboard/src/components/ui/` | Animated components |
| API routes | `backend/app/routers/` | Backend endpoints |

---

## Getting Help

- Ask in **#engineering** on Discord for code questions
- Ask in **#general** for anything else
- When stuck, describe what you tried and paste the error — do not just say "it is not working"

---

## Useful Links

- [React docs](https://react.dev)
- [FastAPI docs](https://fastapi.tiangolo.com)
- [Supabase docs](https://supabase.com/docs)
- [Motion (animations)](https://motion.dev/docs)
