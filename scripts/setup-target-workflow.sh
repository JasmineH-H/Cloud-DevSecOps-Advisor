#!/usr/bin/env bash
set -euo pipefail

TARGET_REPO=""
WORKFLOW_PATH=".github/workflows/sast.yml"
REF_BRANCH=""
WORKFLOW_SOURCE="${WORKFLOW_SOURCE:-JasmineH-H/Cloud-DevSecOps-Advisor/.github/workflows/reusable-sast.yml@main}"

usage() {
  cat <<EOF
Usage: ./scripts/setup-target-workflow.sh <owner/repo> [options]

Options:
  --path <workflow-path>   Workflow file path (default: ${WORKFLOW_PATH})
  --branch <branch>        Commit branch (default: target repo default branch)
  --workflow-source <ref>  Reusable workflow source (default: ${WORKFLOW_SOURCE})
  --help                   Show this help

This script creates/updates the target repo workflow file with the standard
SAST reusable workflow configuration from this repository.
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
    --path)
      [[ $# -lt 2 ]] && { echo "Error: --path requires a value." >&2; exit 1; }
      WORKFLOW_PATH="$2"
      shift 2
      ;;
    --branch)
      [[ $# -lt 2 ]] && { echo "Error: --branch requires a value." >&2; exit 1; }
      REF_BRANCH="$2"
      shift 2
      ;;
    --workflow-source)
      [[ $# -lt 2 ]] && { echo "Error: --workflow-source requires a value." >&2; exit 1; }
      WORKFLOW_SOURCE="$2"
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
require_cmd python3

if [[ ! "${WORKFLOW_PATH}" =~ ^\.github/workflows/[^/]+\.ya?ml$ ]]; then
  echo "Error: --path must be under .github/workflows/ and end in .yml or .yaml" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub CLI. Run: gh auth login" >&2
  exit 1
fi

echo "==> Reading repository access and branch info for ${TARGET_REPO}..."
REPO_INFO="$(gh api "repos/${TARGET_REPO}" 2>/dev/null)" || {
  echo "Repository '${TARGET_REPO}' not found or not accessible." >&2
  exit 1
}

PUSH_ACCESS="$(REPO_INFO="${REPO_INFO}" python3 - <<'PY'
import json
import os

info = json.loads(os.environ["REPO_INFO"])
print(str(info.get("permissions", {}).get("push", False)).lower())
PY
)"
if [[ "${PUSH_ACCESS}" != "true" ]]; then
  echo "Error: Write access required on '${TARGET_REPO}' to commit workflow files." >&2
  exit 1
fi

if [[ -z "${REF_BRANCH}" ]]; then
  REF_BRANCH="$(REPO_INFO="${REPO_INFO}" python3 - <<'PY'
import json
import os

info = json.loads(os.environ["REPO_INFO"])
print(info.get("default_branch", ""))
PY
)"
fi

if [[ -z "${REF_BRANCH}" ]]; then
  echo "Error: Could not determine target branch. Pass --branch explicitly." >&2
  exit 1
fi

if [[ ! "${WORKFLOW_SOURCE}" =~ @v[0-9]+ ]]; then
  echo "Warning: --workflow-source is not pinned to a version tag (for example @v1)." >&2
fi

WORKFLOW_CONTENT="$(cat <<'YAML'
name: SAST Scan

on:
  push:
  pull_request:

jobs:
  sast:
    uses: __WORKFLOW_SOURCE__
    with:
      BACKEND_API_URL: ${{ vars.BACKEND_API_URL }}
      S3_BUCKET: ${{ vars.S3_BUCKET }}
    secrets:
      INGEST_TOKEN_SAST: ${{ secrets.INGEST_TOKEN_SAST }}
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_SESSION_TOKEN: ${{ secrets.AWS_SESSION_TOKEN }}
YAML
)"

WORKFLOW_CONTENT="${WORKFLOW_CONTENT/__WORKFLOW_SOURCE__/${WORKFLOW_SOURCE}}"
CONTENT_B64="$(printf "%s" "${WORKFLOW_CONTENT}" | base64 | tr -d '\n')"

echo "==> Checking existing workflow file..."
set +e
EXISTING_FILE_RESPONSE="$(gh api "repos/${TARGET_REPO}/contents/${WORKFLOW_PATH}?ref=${REF_BRANCH}" 2>&1)"
EXISTING_FILE_STATUS=$?
set -e

EXISTING_SHA=""
if [[ ${EXISTING_FILE_STATUS} -eq 0 ]]; then
  EXISTING_SHA="$(EXISTING_JSON="${EXISTING_FILE_RESPONSE}" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["EXISTING_JSON"])
print(payload.get("sha", ""))
PY
)"
elif [[ "${EXISTING_FILE_RESPONSE}" == *"404"* ]]; then
  EXISTING_SHA=""
else
  echo "Error: Failed to check existing workflow file in ${TARGET_REPO}." >&2
  echo "${EXISTING_FILE_RESPONSE}" >&2
  exit 1
fi

COMMIT_MSG="chore(ci): add reusable SAST workflow"
if [[ -n "${EXISTING_SHA}" ]]; then
  COMMIT_MSG="chore(ci): update reusable SAST workflow"
  echo "==> Updating ${WORKFLOW_PATH} on ${REF_BRANCH}..."
  gh api --method PUT "repos/${TARGET_REPO}/contents/${WORKFLOW_PATH}" \
    -f message="${COMMIT_MSG}" \
    -f content="${CONTENT_B64}" \
    -f sha="${EXISTING_SHA}" \
    -f branch="${REF_BRANCH}" >/dev/null || {
      echo "Error: Failed to write workflow file to ${TARGET_REPO}." >&2
      exit 1
    }
else
  echo "==> Creating ${WORKFLOW_PATH} on ${REF_BRANCH}..."
  gh api --method PUT "repos/${TARGET_REPO}/contents/${WORKFLOW_PATH}" \
    -f message="${COMMIT_MSG}" \
    -f content="${CONTENT_B64}" \
    -f branch="${REF_BRANCH}" >/dev/null || {
      echo "Error: Failed to write workflow file to ${TARGET_REPO}." >&2
      exit 1
    }
fi

echo "Done. Workflow written to ${TARGET_REPO}:${WORKFLOW_PATH} on branch ${REF_BRANCH}."
