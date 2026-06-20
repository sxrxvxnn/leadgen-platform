#!/bin/bash

# Sonar — one-command dev environment setup
# Run this once after cloning the repo: bash setup.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "🚀 Setting up Sonar development environment..."
echo ""

# ── Check required tools ──────────────────────────────────────────────────────

echo "Checking required tools..."

if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found.${NC}"
  echo "  Download it from: https://nodejs.org (choose the LTS version)"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

if ! command -v git &> /dev/null; then
  echo -e "${RED}✗ Git not found.${NC}"
  echo "  Download it from: https://git-scm.com"
  exit 1
fi
echo -e "${GREEN}✓ Git $(git --version | awk '{print $3}')${NC}"

if ! command -v python3 &> /dev/null; then
  echo -e "${YELLOW}⚠ Python not found — backend won't run without it.${NC}"
  echo "  Download it from: https://python.org"
else
  echo -e "${GREEN}✓ Python $(python3 --version | awk '{print $2}')${NC}"
fi

echo ""

# ── Frontend setup ────────────────────────────────────────────────────────────

echo "Installing frontend dependencies..."
cd dashboard
npm install
echo -e "${GREEN}✓ Frontend ready${NC}"
cd ..

echo ""

# ── Backend setup ─────────────────────────────────────────────────────────────

if command -v python3 &> /dev/null; then
  echo "Installing backend dependencies..."
  cd backend
  pip install -r requirements.txt -q
  echo -e "${GREEN}✓ Backend ready${NC}"
  cd ..
  echo ""
fi

# ── .env check ───────────────────────────────────────────────────────────────

echo "Checking for .env file..."
if [ ! -f "dashboard/.env" ]; then
  echo -e "${YELLOW}⚠ No .env file found in dashboard/.${NC}"
  echo "  Ask the team lead to send you the .env file and place it in dashboard/"
  echo "  Without it the app cannot connect to the database."
else
  echo -e "${GREEN}✓ .env file found${NC}"
fi

echo ""

# ── Git config check ──────────────────────────────────────────────────────────

if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
  echo -e "${YELLOW}⚠ Git user not configured. Run these commands:${NC}"
  echo '  git config --global user.name "Your Name"'
  echo '  git config --global user.email "your@email.com"'
  echo ""
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Make sure you have the .env file from the team lead"
echo "  2. Start the frontend:  cd dashboard && npm run dev"
echo "  3. Open http://localhost:5173 in your browser"
echo "  4. Read CONTRIBUTING.md to learn how to make changes"
echo "  5. Pick an issue at: https://github.com/sxrxvxnn/leadgen-platform/issues"
echo ""
echo "Need help? Ask in #engineering on Discord."
echo ""
