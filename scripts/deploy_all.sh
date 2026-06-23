#!/usr/bin/env bash
set -euo pipefail

AUTO_APPROVE="false"
SKIP_BACKEND_DEPLOY="${SKIP_BACKEND_DEPLOY:-false}"
SKIP_FRONTEND_DEPLOY="${SKIP_FRONTEND_DEPLOY:-false}"

# Root paths
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infrastructure"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PENTEST_TOOL_DIR="${PENTEST_TOOL_DIR:-${ROOT_DIR}/scanner/pentest}"
AWS_REGION="${AWS_REGION:-us-east-1}"

usage() {
  cat <<EOF
Usage: ./scripts/deploy_all.sh [options]

Options:
  --auto-approve   Run terraform apply with -auto-approve
  --skip-backend   Skip backend image build/push and ECS redeploy
  --skip-frontend  Skip frontend build/sync to S3
  --infra-only     Terraform apply only (same as --skip-backend --skip-frontend)
  --help           Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto-approve)
      AUTO_APPROVE="true"
      shift
      ;;
    --skip-backend)
      SKIP_BACKEND_DEPLOY="true"
      shift
      ;;
    --skip-frontend)
      SKIP_FRONTEND_DEPLOY="true"
      shift
      ;;
    --infra-only)
      SKIP_BACKEND_DEPLOY="true"
      SKIP_FRONTEND_DEPLOY="true"
      shift
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

# Helper: stop early if required commands are missing
require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd terraform
require_cmd aws
if [[ "${SKIP_BACKEND_DEPLOY}" != "true" ]]; then
  require_cmd docker
fi
if [[ "${SKIP_FRONTEND_DEPLOY}" != "true" ]]; then
  require_cmd npm
fi

# Step 1: Provision/update AWS infrastructure (VPC, ECS, ECR, ALB, S3, Lambda, etc.)
echo "==> Step 1/6: Terraform apply"
cd "$INFRA_DIR"
terraform init
if [[ "$AUTO_APPROVE" == "true" ]]; then
  terraform apply -auto-approve
else
  terraform apply
fi

# Step 2: Read Terraform outputs used by remaining deployment steps
echo "==> Step 2/6: Read Terraform outputs"
BACKEND_ECR="$(terraform output -raw backend_ecr_url)"
PENTEST_ECR="$(terraform output -raw pentest_ecr_url)"
FRONTEND_BUCKET="$(terraform output -raw frontend_bucket_name)"
ALB_DNS="$(terraform output -raw alb_dns_name)"
API_CLOUDFRONT_URL="$(terraform output -raw api_cloudfront_url 2>/dev/null || true)"
FRONTEND_CLOUDFRONT_URL="$(terraform output -raw frontend_cloudfront_url 2>/dev/null || true)"
FRONTEND_CLOUDFRONT_DISTRIBUTION_ID="$(terraform output -raw frontend_cloudfront_distribution_id 2>/dev/null || true)"
CLUSTER_ARN="$(terraform output -raw ecs_cluster_id)"
BACKEND_SERVICE_NAME="$(terraform output -raw backend_service_name)"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

if [[ "${SKIP_BACKEND_DEPLOY}" != "true" ]]; then
  # Step 3: Authenticate Docker to ECR in current AWS account/region
  echo "==> Step 3/6: Login Docker to ECR"
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  # Step 4: Build and push backend image (:latest)
  echo "==> Step 4/6: Build + push backend image"
  cd "$BACKEND_DIR"
  docker buildx build --platform linux/amd64 -t "${BACKEND_ECR}:latest" --push .

  if [[ -n "${PENTEST_TOOL_DIR}" && -f "${PENTEST_TOOL_DIR}/Dockerfile" ]]; then
    echo "==> Optional: Build + push pentest image from ${PENTEST_TOOL_DIR}"
    cd "${PENTEST_TOOL_DIR}"
    docker buildx build --platform linux/amd64 -t "${PENTEST_ECR}:latest" --push .
  else
    echo "==> Skipping pentest image build (expected Dockerfile at ${PENTEST_TOOL_DIR})"
  fi

  # Step 5: Force ECS backend service to pull new image and redeploy tasks
  echo "==> Step 5/6: Force backend ECS redeploy"
  cd "$INFRA_DIR"
  aws ecs update-service \
    --cluster "${CLUSTER_ARN}" \
    --service "${BACKEND_SERVICE_NAME}" \
    --force-new-deployment \
    --region "${AWS_REGION}" >/dev/null
else
  echo "==> Skipping backend deploy steps (CI workflow deploy-backend.yml can handle backend updates)"
fi

if [[ "${SKIP_FRONTEND_DEPLOY}" != "true" ]]; then
  # Step 6: Build frontend with current ALB URL and sync static assets to S3 bucket
  echo "==> Step 6/6: Build + deploy frontend"
  cd "$FRONTEND_DIR"
  if [[ ! -d "node_modules" ]]; then
    echo "Installing frontend dependencies..."
    npm ci
  fi
  if [[ -n "${API_CLOUDFRONT_URL}" ]]; then
    echo "VITE_API_URL=${API_CLOUDFRONT_URL}" > .env
  else
    echo "VITE_API_URL=http://${ALB_DNS}" > .env
  fi
  npm run build
  aws s3 sync dist/ "s3://${FRONTEND_BUCKET}" --delete >/dev/null
  if [[ -n "${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID}" ]]; then
    aws cloudfront create-invalidation \
      --distribution-id "${FRONTEND_CLOUDFRONT_DISTRIBUTION_ID}" \
      --paths "/*" >/dev/null
  fi
else
  echo "==> Skipping frontend deploy step"
fi

# Final output hints
echo
echo "Deploy complete."
if [[ -n "${FRONTEND_CLOUDFRONT_URL}" ]]; then
  echo "Frontend URL: ${FRONTEND_CLOUDFRONT_URL}"
else
  echo "Frontend URL: http://$(cd "$INFRA_DIR" && terraform output -raw frontend_website_url)"
fi
JUICESHOP_URL="$(cd "$INFRA_DIR" && terraform output -raw juiceshop_url 2>/dev/null || true)"
if [[ -n "${JUICESHOP_URL}" ]]; then
  echo "Demo Target URL: ${JUICESHOP_URL}"
else
  echo "Demo Target URL: unavailable (run: cd infrastructure && terraform output -raw juiceshop_url)"
fi
