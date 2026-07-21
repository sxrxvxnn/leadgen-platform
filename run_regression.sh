#!/bin/bash
# Run classification regression suite before every deploy.
# Usage: ./run_regression.sh
# All 26 cases must pass. If any fail, fix the classifier before deploying.

set -e

echo "Running Sonar classifier regression suite..."
python3 -m pytest backend/tests/test_classifier_regression.py -v

echo ""
echo "All regression tests passed. Safe to deploy."
