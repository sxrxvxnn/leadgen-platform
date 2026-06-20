# How to Contribute — Step by Step

This guide assumes you are new to coding. Every step is explained in plain English.

---

## Part 1 — Set up your computer (do this once)

### 1. Install VS Code
Download from [code.visualstudio.com](https://code.visualstudio.com) and install it.
This is where you will write and edit code.

### 2. Install Git
Download from [git-scm.com](https://git-scm.com) and install it.
Git is a tool that saves snapshots of your code so you can undo mistakes and work with others without overwriting each other's work.

### 3. Open a terminal
- **Mac:** Press `Cmd + Space`, type "Terminal", press Enter
- **Windows:** Press the Windows key, type "Command Prompt", press Enter

You will type commands here. Do not be scared — you can not break anything by typing wrong commands (the worst that happens is an error message).

### 4. Get the project onto your computer
Type this in the terminal, then press Enter:
```
git clone https://github.com/sxrxvxnn/leadgen-platform.git
```
This downloads all the code to a folder called `leadgen-platform` on your computer.

### 5. Open the project in VS Code
In VS Code, go to **File → Open Folder** and select the `leadgen-platform` folder.

### 6. Get the .env file
Ask the team lead to send you the `.env` file. Put it inside the `dashboard/` folder.
This file contains secret keys — **never send it to anyone or commit it to GitHub.**

### 7. Install and run the frontend
In your terminal, type these one at a time:
```
cd dashboard
npm install
npm run dev
```
Then open http://localhost:5173 in your browser. You should see the Sonar site running locally on your computer.

---

## Part 2 — Before you start working

### Pick an issue
Go to [github.com/sxrxvxnn/leadgen-platform/issues](https://github.com/sxrxvxnn/leadgen-platform/issues)
Click on an issue with the **green `good first issue` label**.
Leave a comment saying "I'll take this" so no one else picks the same one.

### Understand what a branch is
Imagine the project is a Google Doc. The `main` branch is the official published version.
When you want to make edits, you make a copy (called a **branch**), edit the copy, and then ask for it to be merged back.

This way, your in-progress work never breaks the live site.

---

## Part 3 — Making your change

### Step 1: Make sure your code is up to date
```
git checkout main
git pull
```
Always do this before starting new work.

### Step 2: Create your branch
Replace `yourname` and `what-you-are-doing` with your actual name and task:
```
git checkout -b yourname/what-you-are-doing
```
Example: `git checkout -b priya/faq-content`

You are now on your own branch. Changes here do not affect the live site.

### Step 3: Make your changes in VS Code
Open the file mentioned in your issue and make the changes.
Save the file with `Cmd + S` (Mac) or `Ctrl + S` (Windows).

### Step 4: Check what you changed
```
git status
```
This shows which files you edited. Green = new file, red = modified file.

### Step 5: Save your changes with Git
```
git add .
git commit -m "describe what you did here"
```
The message in quotes should describe your change, for example:
- `"add faq questions to landing page"`
- `"fix footer copyright year"`

### Step 6: Upload your changes to GitHub
```
git push origin yourname/what-you-are-doing
```

### Step 7: Open a Pull Request
1. Go to [github.com/sxrxvxnn/leadgen-platform](https://github.com/sxrxvxnn/leadgen-platform)
2. You will see a yellow banner saying your branch was recently pushed — click **"Compare & pull request"**
3. Write a short description of what you changed
4. Click **"Create pull request"**
5. Tag the team lead as a reviewer and wait for their approval

That is it! The team lead will review, ask for changes if needed, and merge it.

---

## Common errors and fixes

| Error | What it means | Fix |
|---|---|---|
| `npm: command not found` | Node.js is not installed | Install from nodejs.org |
| `git: command not found` | Git is not installed | Install from git-scm.com |
| `Cannot find module` | Missing packages | Run `npm install` in the `dashboard/` folder |
| `localhost:5173 not loading` | Server is not running | Run `npm run dev` in the `dashboard/` folder |
| White screen in browser | JavaScript error | Open the browser console (F12) and read the red error |

---

## Rules to follow

- **Never push directly to `main`** — always use a branch + Pull Request
- **Never commit the `.env` file** — it contains secrets
- **One task per branch** — do not mix multiple fixes in one branch
- **Ask when stuck** — post in #engineering on Discord after trying for 20 minutes

---

## Glossary (words you will hear)

| Word | Meaning |
|---|---|
| **Repository (repo)** | The project folder on GitHub |
| **Branch** | A copy of the project you can safely edit |
| **Commit** | A saved snapshot of your changes |
| **Pull Request (PR)** | A request to merge your changes into `main` |
| **Merge** | Combining your branch back into `main` |
| **npm install** | Downloads all the packages the project needs |
| **localhost** | Your own computer acting as a website server |
| **.env file** | A file with secret keys — never share this |
