#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infrastructure"
REPO_OVERRIDE=""

usage() {
  cat <<EOF
Usage: ./scripts/setup-advisor-repo.sh [options]

Options:
  --repo <owner/repo>   Override target repo (default: current gh repo)
  --help                Show this help

What it sets:
  - VITE_API_URL (from terraform output alb_dns_name)
  - FRONTEND_BUCKET (from terraform output frontend_bucket_name)
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
    --repo)
      [[ $# -lt 2 ]] && { echo "Error: --repo requires a value." >&2; exit 1; }
      REPO_OVERRIDE="$2"
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

require_cmd gh
require_cmd terraform

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub CLI. Run: gh auth login" >&2
  exit 1
fi

if [[ ! -d "${INFRA_DIR}" ]]; then
  echo "Cannot find infrastructure directory at: ${INFRA_DIR}" >&2
  exit 1
fi

if [[ ! -f "${INFRA_DIR}/terraform.tfstate" ]]; then
  echo "No terraform.tfstate found in ${INFRA_DIR}. Run terraform apply first." >&2
  exit 1
fi

TARGET_REPO="${REPO_OVERRIDE}"
if [[ -z "${TARGET_REPO}" ]]; then
  TARGET_REPO="$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)"
fi

if [[ -z "${TARGET_REPO}" ]]; then
  echo "Could not determine target repo. Run from repo root or pass --repo owner/repo." >&2
  exit 1
fi

if [[ ! "${TARGET_REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Repository must be in owner/repo format. Got: ${TARGET_REPO}" >&2
  exit 1
fi

ADMIN_ACCESS="$(gh api "repos/${TARGET_REPO}" --jq '.permissions.admin // false' 2>/dev/null || echo 'false')"
if [[ "${ADMIN_ACCESS}" != "true" ]]; then
  echo "Error: Repository '${TARGET_REPO}' not accessible or admin access is missing." >&2
  exit 1
fi

ALB_DNS="$(cd "${INFRA_DIR}" && terraform output -raw alb_dns_name 2>/dev/null)" || {
  echo "Error: Could not read 'alb_dns_name' from Terraform outputs." >&2
  exit 1
}

FRONTEND_BUCKET="$(cd "${INFRA_DIR}" && terraform output -raw frontend_bucket_name 2>/dev/null)" || {
  echo "Error: Could not read 'frontend_bucket_name' from Terraform outputs." >&2
  exit 1
}

VITE_API_URL="http://${ALB_DNS}"

echo "Setting GitHub Actions variables on ${TARGET_REPO}..."
gh variable set VITE_API_URL --repo "${TARGET_REPO}" --body "${VITE_API_URL}"
gh variable set FRONTEND_BUCKET --repo "${TARGET_REPO}" --body "${FRONTEND_BUCKET}"

echo "Done. Updated repo variables on ${TARGET_REPO}:"
echo "- VITE_API_URL=${VITE_API_URL}"
echo "- FRONTEND_BUCKET=${FRONTEND_BUCKET}"
