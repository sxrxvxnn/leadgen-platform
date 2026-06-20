# Sonar — B2B Lead Intelligence Platform

**Live site:** [sonarleads.vercel.app](https://sonarleads.vercel.app)

Sonar helps businesses find and track potential customers (called "leads"). It automatically fills in company information like their website, LinkedIn, emails, and team size.

---

## New to the team? Start here

**Step 1 — Install these tools** (in this order, click each link):

| Tool | What it is | Download |
|---|---|---|
| VS Code | The app you write code in | [code.visualstudio.com](https://code.visualstudio.com) |
| Git | Saves and tracks your code changes | [git-scm.com](https://git-scm.com) |
| Node.js | Runs the frontend | [nodejs.org](https://nodejs.org) — download the LTS version |
| Python | Runs the backend | [python.org](https://python.org) — download 3.11 or newer |

**Step 2 — Join Discord** and say hi in #general. The team lead will give you the `.env` file you need.

**Step 3 — Pick up an issue** at [github.com/sxrxvxnn/leadgen-platform/issues](https://github.com/sxrxvxnn/leadgen-platform/issues) — look for ones labeled `good first issue`.

**Step 4 — Read CONTRIBUTING.md** — it explains exactly how to make changes and submit them.

---

## What does the code look like?

The project has two main parts:

### Frontend (what users see in their browser)
- Written in **React** — a popular way to build websites using JavaScript
- Files live in `dashboard/src/`
- The main pages are in `dashboard/src/pages/`
- Run it with: `cd dashboard` then `npm install` then `npm run dev`
- Opens at http://localhost:5173

### Backend (the server that does the hard work)
- Written in **Python** using a tool called FastAPI
- Files live in `backend/app/`
- Run it with: `cd backend` then `pip install -r requirements.txt` then `uvicorn app.main:app --reload`
- Opens at http://localhost:8000

You likely only need to run the frontend for most tasks.

---

## Folder map

```
leadgen-platform/
│
├── dashboard/src/pages/        ← Main pages (Landing, Dashboard, Companies…)
├── dashboard/src/components/   ← Smaller reusable pieces of the UI
├── dashboard/public/           ← Images and static files
│
├── backend/app/routers/        ← API endpoints (URLs the frontend calls)
├── backend/app/services/       ← Business logic (enrichment, scoring)
│
└── .github/workflows/          ← Automated tasks (Discord notifications)
```

---

## Getting help

- Stuck? Ask in **#engineering** on Discord
- Not sure what to work on? Ask the team lead
- Something broken? Check that you ran `npm install` and have the `.env` file
