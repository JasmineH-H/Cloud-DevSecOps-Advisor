#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
SAST_SECRET_NAME="${SAST_SECRET_NAME:-devsecops/sast}"
PENTEST_SECRET_NAME="${PENTEST_SECRET_NAME:-devsecops/pentest}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infrastructure"

usage() {
  cat <<EOF
Usage: ./scripts/setup-secrets.sh [options]

Options:
  --region <aws-region>          AWS region (default: ${AWS_REGION})
  --sast-secret <name>           Secret name for SAST token (default: ${SAST_SECRET_NAME})
  --pentest-secret <name>        Secret name for pentest token (default: ${PENTEST_SECRET_NAME})
  --help                         Show this help message

Environment variable overrides:
  AWS_REGION
  SAST_SECRET_NAME
  PENTEST_SECRET_NAME
  INGEST_TOKEN_SAST
  INGEST_TOKEN_PENTEST
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd aws

if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Error: AWS credentials are invalid or expired. Refresh your session token and try again." >&2
  exit 1
fi

prompt_secret() {
  local prompt_label="$1"
  local current_value="${2:-}"
  local value=""
  local sanitized=""

  if [[ -n "$current_value" ]]; then
    value="$current_value"
  else
    read -r -s -p "${prompt_label}: " value
    echo
  fi

  if [[ -z "$value" ]]; then
    echo "Secret value cannot be empty." >&2
    exit 1
  fi

  # Remove CR/LF and trim surrounding whitespace to avoid invalid header chars downstream.
  sanitized="$(printf "%s" "$value" | tr -d '\r\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"

  if [[ -z "$sanitized" ]]; then
    echo "Secret value cannot be empty after sanitization." >&2
    exit 1
  fi

  if [[ "$sanitized" != "$value" ]]; then
    echo "Note: Sanitized hidden whitespace/newline characters from ${prompt_label}."
  fi

  printf "%s" "$sanitized"
}

upsert_secret_plaintext() {
  local name="$1"
  local value="$2"

  if aws secretsmanager describe-secret --secret-id "$name" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value \
      --secret-id "$name" \
      --secret-string "$value" \
      --region "$AWS_REGION" >/dev/null
    echo "Updated secret: $name"
  else
    aws secretsmanager create-secret \
      --name "$name" \
      --secret-string "$value" \
      --region "$AWS_REGION" >/dev/null
    echo "Created secret: $name"
  fi
}

echo "Configuring Secrets Manager values in region: ${AWS_REGION}"
echo "Secrets will be stored as plaintext token strings (not JSON objects)."

SAST_TOKEN="$(prompt_secret "Enter INGEST_TOKEN_SAST" "${INGEST_TOKEN_SAST:-}")"
PENTEST_TOKEN="$(prompt_secret "Enter INGEST_TOKEN_PENTEST" "${INGEST_TOKEN_PENTEST:-}")"

upsert_secret_plaintext "$SAST_SECRET_NAME" "$SAST_TOKEN"
upsert_secret_plaintext "$PENTEST_SECRET_NAME" "$PENTEST_TOKEN"

tf_output_or_fallback() {
  local output_name="$1"
  local fallback="$2"
  local value=""

  if command -v terraform >/dev/null 2>&1 && [[ -d "${INFRA_DIR}" ]] && [[ -f "${INFRA_DIR}/terraform.tfstate" ]]; then
    value="$(cd "${INFRA_DIR}" && terraform output -raw "${output_name}" 2>/dev/null || true)"

    # Ignore Terraform warning/error text that can appear on stdout when outputs are unavailable.
    if [[ -n "${value}" ]] \
      && [[ "${value}" != *"Warning: No outputs found"* ]] \
      && [[ "${value}" != *"The output variable requested could not be found"* ]] \
      && [[ "${value}" != "╷"* ]] \
      && [[ "${value}" != "╵"* ]]; then
      printf "%s" "${value}"
      return
    fi
  fi

  printf "%s" "${fallback}"
}

ALB_DNS="$(tf_output_or_fallback "alb_dns_name" "<run: cd infrastructure && terraform output -raw alb_dns_name>")"
REPORTS_BUCKET="$(tf_output_or_fallback "reports_s3_bucket" "<run: cd infrastructure && terraform output -raw reports_s3_bucket>")"
FRONTEND_BUCKET="$(tf_output_or_fallback "frontend_bucket_name" "<run: cd infrastructure && terraform output -raw frontend_bucket_name>")"

echo
echo "Done. Next steps (safe checklist):"
echo "1) In each target GitHub repo (SAST workflow):"
echo "   - Add secret INGEST_TOKEN_SAST (must match ${SAST_SECRET_NAME})"
echo "   - Add AWS secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN"
echo "2) In target GitHub repo variables:"
echo "   - BACKEND_API_URL=http://${ALB_DNS}"
echo "   - S3_BUCKET=${REPORTS_BUCKET}"
echo "3) In Cloud-DevSecOps-Advisor repo variables:"
echo "   - VITE_API_URL=http://${ALB_DNS}"
echo "   - FRONTEND_BUCKET=${FRONTEND_BUCKET}"
echo
echo "Tip: If any value above still shows <run: ...>, apply Terraform first and re-run this script."
