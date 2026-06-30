#!/bin/bash
# Deploy latest backend code to EC2 worker and restart the service.
# Run from repo root: ./scripts/deploy-worker.sh

set -e

EC2_HOST="ec2-user@98.93.83.113"
KEY="$HOME/Downloads/sonar-worker-key.pem"

echo "→ Syncing backend to EC2..."
rsync -avz --exclude='venv' --exclude='__pycache__' --exclude='.env' \
  -e "ssh -i $KEY" \
  ./backend/ \
  "$EC2_HOST:~/backend/"

echo "→ Restarting sonar-worker service..."
ssh -i "$KEY" "$EC2_HOST" "sudo systemctl restart sonar-worker && sudo systemctl status sonar-worker --no-pager"

echo "✓ Worker deployed and restarted."
