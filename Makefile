VERCEL_ORG_BACKEND  = team_kyJW545jDPkDZUznU0g1nB4s
VERCEL_PROJECT_BACKEND = prj_GvDaQfLQr8RGwU3cTJjn3S3nw6Mk

.PHONY: test deploy deploy-backend deploy-frontend

# Run classifier regression suite
test:
	@python3 -m pytest backend/tests/test_classifier_regression.py -v

# Deploy only the backend (tests run automatically via pre-push hook)
deploy-backend:
	@VERCEL_ORG_ID=$(VERCEL_ORG_BACKEND) \
	 VERCEL_PROJECT_ID=$(VERCEL_PROJECT_BACKEND) \
	 vercel deploy --prod --yes

# Deploy only the frontend
deploy-frontend:
	@vercel deploy --prod --yes

# Full deploy: test → push → deploy both
# Usage: make deploy
deploy: test
	@echo ""
	@echo "Tests passed — pushing and deploying..."
	@echo ""
	@git push origin main
	@echo ""
	@echo "Deploying frontend..."
	@vercel deploy --prod --yes
	@echo ""
	@echo "Deploying backend..."
	@VERCEL_ORG_ID=$(VERCEL_ORG_BACKEND) \
	 VERCEL_PROJECT_ID=$(VERCEL_PROJECT_BACKEND) \
	 vercel deploy --prod --yes
	@echo ""
	@echo "Done. Both services live."
