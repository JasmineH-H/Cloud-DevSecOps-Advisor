#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infrastructure"
AWS_REGION="${AWS_REGION:-us-east-1}"
SAST_SECRET_NAME="${SAST_SECRET_NAME:-devsecops/sast}"
PENTEST_SECRET_NAME="${PENTEST_SECRET_NAME:-devsecops/pentest}"
TARGET_URL="${TARGET_URL:-}"
TARGET_REPO=""

usage() {
  cat <<EOF
Usage: ./scripts/setup-target-repo.sh <owner/repo> [options]

Options:
  --target-url <url>             Optional TARGET_URL variable for pentest workflows
  --region <aws-region>          AWS region for Secrets Manager lookups (default: ${AWS_REGION})
  --sast-secret <name>           Secrets Manager name for SAST token (default: ${SAST_SECRET_NAME})
  --pentest-secret <name>        Secrets Manager name for pentest token (default: ${PENTEST_SECRET_NAME})
  --help                         Show this help

Required environment variables:
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_SESSION_TOKEN

Notes:
  - Run this after terraform apply, so required outputs exist.
  - This script sets GitHub Actions secrets/variables on the target repository.
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

hydrate_aws_env_from_config() {
  # Support users who configured AWS via `aws configure` but did not export env vars.
  if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]]; then
    AWS_ACCESS_KEY_ID="$(aws configure get aws_access_key_id 2>/dev/null || true)"
    export AWS_ACCESS_KEY_ID
  fi

  if [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
    AWS_SECRET_ACCESS_KEY="$(aws configure get aws_secret_access_key 2>/dev/null || true)"
    export AWS_SECRET_ACCESS_KEY
  fi

  if [[ -z "${AWS_SESSION_TOKEN:-}" ]]; then
    AWS_SESSION_TOKEN="$(aws configure get aws_session_token 2>/dev/null || true)"
    export AWS_SESSION_TOKEN
  fi
}

extract_token_value() {
  local secret_string="$1"
  local json_key="$2"

  if [[ "${secret_string}" == \{* ]]; then
    SECRET_STRING="${secret_string}" JSON_KEY="${json_key}" python3 - <<'PY'
import json
import os
import sys

secret_string = os.environ["SECRET_STRING"]
json_key = os.environ["JSON_KEY"]

try:
    data = json.loads(secret_string)
except Exception:
    print("")
    sys.exit(0)

if isinstance(data, dict) and not data:
    print("")
elif isinstance(data, dict) and json_key in data and str(data[json_key]).strip():
    print(str(data[json_key]).strip())
else:
    print("")
PY
  else
    SECRET_STRING="${secret_string}" python3 - <<'PY'
import os
print(os.environ["SECRET_STRING"].strip())
PY
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-url)
      [[ $# -lt 2 ]] && { echo "Error: --target-url requires a value." >&2; exit 1; }
      TARGET_URL="$2"
      shift 2
      ;;
    --region)
      [[ $# -lt 2 ]] && { echo "Error: --region requires a value." >&2; exit 1; }
      AWS_REGION="$2"
      shift 2
      ;;
    --sast-secret)
      [[ $# -lt 2 ]] && { echo "Error: --sast-secret requires a value." >&2; exit 1; }
      SAST_SECRET_NAME="$2"
      shift 2
      ;;
    --pentest-secret)
      [[ $# -lt 2 ]] && { echo "Error: --pentest-secret requires a value." >&2; exit 1; }
      PENTEST_SECRET_NAME="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ -z "${TARGET_REPO}" ]]; then
        TARGET_REPO="$1"
        shift
      else
        echo "Unknown option: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "${TARGET_REPO}" ]]; then
  echo "Error: <owner/repo> is required." >&2
  usage
  exit 1
fi

if [[ ! "${TARGET_REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Repository must be in owner/repo format. Got: ${TARGET_REPO}" >&2
  exit 1
fi

require_cmd gh
require_cmd aws
require_cmd terraform
require_cmd python3
hydrate_aws_env_from_config
require_env AWS_ACCESS_KEY_ID
require_env AWS_SECRET_ACCESS_KEY
require_env AWS_SESSION_TOKEN

if [[ ! -d "${INFRA_DIR}" ]]; then
  echo "Cannot find infrastructure directory at: ${INFRA_DIR}" >&2
  exit 1
fi

if [[ ! -f "${INFRA_DIR}/terraform.tfstate" ]]; then
  echo "No terraform.tfstate found in ${INFRA_DIR}. Run terraform apply (or ./scripts/deploy_all.sh) first." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub CLI. Run: gh auth login" >&2
  exit 1
fi

if ! gh repo view "${TARGET_REPO}" >/dev/null 2>&1; then
  echo "Repository '${TARGET_REPO}' not found or not accessible." >&2
  exit 1
fi

ADMIN_ACCESS="$(gh api "repos/${TARGET_REPO}" --jq '.permissions.admin // false' 2>/dev/null || echo 'false')"
if [[ "${ADMIN_ACCESS}" != "true" ]]; then
  echo "Error: Admin access required on '${TARGET_REPO}' to manage secrets." >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "Error: AWS credentials are invalid or expired. Refresh your session token." >&2
  exit 1
fi

echo "Reading Terraform outputs from ${INFRA_DIR}..."
ALB_DNS="$(cd "${INFRA_DIR}" && terraform output -raw alb_dns_name 2>/dev/null)" || {
  echo "Error: Could not read 'alb_dns_name' from Terraform outputs." >&2
  exit 1
}
REPORTS_BUCKET="$(cd "${INFRA_DIR}" && terraform output -raw reports_s3_bucket 2>/dev/null)" || {
  echo "Error: Could not read 'reports_s3_bucket' from Terraform outputs." >&2
  exit 1
}
BACKEND_API_URL="http://${ALB_DNS}"

echo "Reading ingest tokens from Secrets Manager (${AWS_REGION})..."
SAST_SECRET_STRING="$(aws secretsmanager get-secret-value --secret-id "${SAST_SECRET_NAME}" --region "${AWS_REGION}" --query SecretString --output text 2>/dev/null)" || {
  echo "Error: Could not read secret '${SAST_SECRET_NAME}' from Secrets Manager." >&2
  exit 1
}
PENTEST_SECRET_STRING="$(aws secretsmanager get-secret-value --secret-id "${PENTEST_SECRET_NAME}" --region "${AWS_REGION}" --query SecretString --output text 2>/dev/null)" || {
  echo "Error: Could not read secret '${PENTEST_SECRET_NAME}' from Secrets Manager." >&2
  exit 1
}

INGEST_TOKEN_SAST="$(extract_token_value "${SAST_SECRET_STRING}" "ingest_token_sast")"
INGEST_TOKEN_PENTEST="$(extract_token_value "${PENTEST_SECRET_STRING}" "ingest_token_pentest")"

if [[ -z "${INGEST_TOKEN_SAST}" || -z "${INGEST_TOKEN_PENTEST}" ]]; then
  echo "Failed to resolve ingest tokens from Secrets Manager." >&2
  echo "Ensure ${SAST_SECRET_NAME} and ${PENTEST_SECRET_NAME} contain plaintext token strings or expected JSON keys." >&2
  exit 1
fi

echo "Setting GitHub Actions secrets on ${TARGET_REPO}..."
gh secret set AWS_ACCESS_KEY_ID --repo "${TARGET_REPO}" --body "${AWS_ACCESS_KEY_ID}"
gh secret set AWS_SECRET_ACCESS_KEY --repo "${TARGET_REPO}" --body "${AWS_SECRET_ACCESS_KEY}"
gh secret set AWS_SESSION_TOKEN --repo "${TARGET_REPO}" --body "${AWS_SESSION_TOKEN}"
gh secret set INGEST_TOKEN_SAST --repo "${TARGET_REPO}" --body "${INGEST_TOKEN_SAST}"
gh secret set INGEST_TOKEN_PENTEST --repo "${TARGET_REPO}" --body "${INGEST_TOKEN_PENTEST}"

echo "Setting GitHub Actions variables on ${TARGET_REPO}..."
gh variable set BACKEND_API_URL --repo "${TARGET_REPO}" --body "${BACKEND_API_URL}"
gh variable set S3_BUCKET --repo "${TARGET_REPO}" --body "${REPORTS_BUCKET}"

if [[ -n "${TARGET_URL}" ]]; then
  gh variable set TARGET_URL --repo "${TARGET_REPO}" --body "${TARGET_URL}"
  echo "Set TARGET_URL=${TARGET_URL}"
else
  echo "Warning: TARGET_URL not set. Pentest workflows in ${TARGET_REPO} will fail without it." >&2
  echo "         Re-run with --target-url <url> to set it." >&2
fi

echo
echo "Done. Target repo configured: ${TARGET_REPO}"
echo "Set variables:"
echo "- BACKEND_API_URL=${BACKEND_API_URL}"
echo "- S3_BUCKET=${REPORTS_BUCKET}"
[[ -n "${TARGET_URL}" ]] && echo "- TARGET_URL=${TARGET_URL}"
