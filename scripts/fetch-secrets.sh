#!/bin/bash
# fetch-secrets.sh
# Fetches secrets from AWS Secrets Manager and writes to .env
# This runs before docker compose starts — no secrets ever stored in git

set -euo pipefail

SECRET_NAME="devops-api/production"
REGION="us-east-1"
ENV_FILE="$(dirname "$0")/../.env"

echo "Fetching secrets from AWS Secrets Manager..."

SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --query SecretString \
  --output text)

# Parse JSON and write to .env file
echo "NODE_ENV=$(echo $SECRET | python3 -c "import sys,json; print(json.load(sys.stdin)['NODE_ENV'])")" > "$ENV_FILE"
echo "APP_VERSION=$(echo $SECRET | python3 -c "import sys,json; print(json.load(sys.stdin)['APP_VERSION'])")" >> "$ENV_FILE"
echo "GRAFANA_PASSWORD=$(echo $SECRET | python3 -c "import sys,json; print(json.load(sys.stdin)['GRAFANA_PASSWORD'])")" >> "$ENV_FILE"

echo "Secrets written to .env successfully."
echo "Starting application..."
