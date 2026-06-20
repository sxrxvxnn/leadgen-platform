# Contributing to Sonar

Welcome to the team! This guide explains everything you need to know to start contributing.

---

## Before You Start

1. **Clone the repo**
   ```bash
   git clone https://github.com/sxrxvxnn/leadgen-platform.git
   cd leadgen-platform
   ```

2. **Get the `.env` file** from the team lead — you need this to connect to the database and APIs. Never commit this file.

3. **Install and run** (see README for full steps)

4. **Join Discord** — all team communication happens there. Say hi in #general.

---

## Picking Up Work

1. Go to the [Issues tab](https://github.com/sxrxvxnn/leadgen-platform/issues) on GitHub
2. Find an issue labeled **`good first issue`** — these are designed for beginners
3. Comment "I'll take this" so nobody else picks the same one
4. Get assigned by the team lead

---

## Step-by-Step: Making a Change

```
main branch (protected) ← you never push here directly
     │
     └── your-name/issue-description  ← your working branch
```

```bash
# Start fresh from main every time
git checkout main
git pull origin main

# Create your branch
git checkout -b yourname/what-youre-doing

# Make changes in your editor, then:
git add .
git commit -m "feat: describe what you did"
git push origin yourname/what-youre-doing

# Then open a Pull Request on GitHub
```

---

## Opening a Pull Request (PR)

1. Go to the repo on GitHub
2. Click **"Compare & pull request"** (appears after you push)
3. Write a short description: what you changed and why
4. Tag a reviewer (the team lead)
5. Wait for approval before merging

**A PR should do one thing.** Don't fix three bugs in one PR — open three separate PRs.

---

## Code Style

- **React components** — use functional components, not class components
- **Styles** — inline styles only, e.g. `style={{ color: 'red', fontSize: 16 }}` — no Tailwind classes
- **Colors** — always use the brand colors: `#E7000B` (red), `#0A0A0A` (dark), `#F5F5F5` (light text)
- **No console.log** in PRs — remove them before committing
- **Descriptive names** — `companyList` not `data`, `handleSubmit` not `fn`

---

## Common Mistakes to Avoid

| Don't | Do instead |
|---|---|
| Push to `main` directly | Always use a branch + PR |
| Commit `.env` files | Add to `.gitignore`, share privately |
| Use Tailwind classes | Use inline `style={{}}` |
| `git add .` without checking | Run `git status` first to see what you're committing |
| Leave `console.log` statements | Remove before committing |

---

## Asking for Help

Stuck? That is completely normal. Here is what to do:

1. Try for 15–20 minutes on your own
2. Google the error message
3. If still stuck, post in **#engineering** on Discord with:
   - What you were trying to do
   - What you tried
   - The exact error message (screenshot or paste)

Nobody will judge you for asking — asking is how you learn faster.
