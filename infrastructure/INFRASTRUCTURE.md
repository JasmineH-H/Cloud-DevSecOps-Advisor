# End-to-end: AWS + Terraform + containers

Run these commands from the repo root: `Cloud-DevSecOps-Advisor/`.

## Order (do this in sequence)

1. Configure AWS credentials + Secrets Manager.
2. Run `terraform apply` in `infrastructure/`.
3. Read Terraform outputs.
4. Use those output values to configure GitHub variables.
5. Run `./scripts/deploy_all.sh` (this handles image push, ECS redeploy, and frontend sync).

---

## Prerequisites (before Terraform)

- Install [Terraform](https://www.terraform.io/downloads), [AWS CLI](https://aws.amazon.com/cli/), Docker, Node.js, and [GitHub CLI (`gh`)](https://cli.github.com/).
- Configure AWS credentials (Learner Lab rotates tokens):

```bash
aws configure
# Access Key ID, Secret Access Key, Session Token, region us-east-1, output json
```

- Authenticate GitHub CLI:

```bash
gh auth login
```

- Create Secrets Manager secrets used by Terraform:

Required: automate secret creation/update:

```bash
./scripts/setup-secrets.sh
```

This script securely prompts for token values (no echo), writes plaintext secret strings to AWS Secrets Manager, and prints the next GitHub setup checklist. Run this before `terraform apply`.

| Secret name         | Value                                   |
| ------------------- | --------------------------------------- |
| `devsecops/sast`    | Bearer token for `POST /ingest/sast`    |
| `devsecops/pentest` | Bearer token for `POST /ingest/pentest` |

- Ensure IAM role in this stack matches your lab role (`LabRole` by default in `iam.tf`).

---

## Run Terraform apply

From repo root:

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

Optional: create `terraform.tfvars` from `terraform.tfvars.example` before apply.

If `pentest_target_url` is empty, pentest defaults to the Juice Shop URL created by this stack.

---

## Get values from Terraform outputs

Note: this step is optional. You do **not** need to run it for `./scripts/deploy_all.sh` because that script reads Terraform outputs automatically. Use this section only for manual setup, debugging, or verification.

Still inside `infrastructure/`, run:

```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
FRONTEND_BUCKET=$(terraform output -raw frontend_bucket_name)
REPORTS_BUCKET=$(terraform output -raw reports_s3_bucket)
BACKEND_ECR=$(terraform output -raw backend_ecr_url)
PENTEST_ECR=$(terraform output -raw pentest_ecr_url)
CLUSTER_ARN=$(terraform output -raw ecs_cluster_id)
```

You can verify:

```bash
echo "$ALB_DNS"
echo "$FRONTEND_BUCKET"
echo "$REPORTS_BUCKET"
```

---

## Configure target GitHub repos (recommended: script)

Run once per target repository after `terraform apply`:

```bash
./scripts/setup-target-repo.sh owner/repo
./scripts/setup-target-workflow.sh owner/repo
```

Optional target URL variable (for pentest workflows):

```bash
./scripts/setup-target-repo.sh owner/repo --target-url https://example.com
./scripts/setup-target-workflow.sh owner/repo
```

What this script sets on the target repo:

- Secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
  - `INGEST_TOKEN_SAST`
  - `INGEST_TOKEN_PENTEST`
- Variables:
  - `BACKEND_API_URL` (from Terraform `alb_dns_name`)
  - `S3_BUCKET` (from Terraform `reports_s3_bucket`)
  - `TARGET_URL` (only when `--target-url` is provided)

What `setup-target-workflow.sh` does:

- Creates/updates `.github/workflows/sast.yml` in the target repo with the reusable SAST workflow configuration.

Manual fallback:

- `Settings -> Secrets and variables -> Actions` on each target repo.

### Configure this repo (`Cloud-DevSecOps-Advisor`) frontend deploy variables

Recommended:

```bash
./scripts/setup-advisor-repo.sh
```

Optional (if you need to target a different repo explicitly):

```bash
./scripts/setup-advisor-repo.sh --repo owner/repo
```

Manual fallback:

`Settings -> Secrets and variables -> Actions -> Variables`

- `VITE_API_URL = http://<ALB_DNS>`
- `FRONTEND_BUCKET = <FRONTEND_BUCKET>`

---

## Deploy application (default path)

After prerequisites + Terraform output-based GitHub variables are set, run:

```bash
./scripts/deploy_all.sh --auto-approve
```

Interactive option:

```bash
./scripts/deploy_all.sh
```

Infra only (recommended when backend/frontend are deployed by GitHub Actions):

```bash
./scripts/deploy_all.sh --infra-only
```

Skip only one side:

```bash
./scripts/deploy_all.sh --skip-backend
./scripts/deploy_all.sh --skip-frontend
```

Optional pentest image source override:

```bash
PENTEST_TOOL_DIR=/path/to/SAST-Pentest-Tool/pentest ./scripts/deploy_all.sh
```

What `deploy_all.sh` does for you:

- Runs Terraform apply
- Reads Terraform outputs
- Optionally logs in to ECR, builds/pushes backend image, and forces ECS backend redeploy
- Optionally builds and syncs frontend to S3

Verify:

```bash
cd infrastructure
ALB_DNS=$(terraform output -raw alb_dns_name)
curl -s "http://${ALB_DNS}/health"
terraform output -raw frontend_website_url
```

---

## Optional checks

- Juice Shop URL: `cd infrastructure && terraform output -raw juiceshop_url`
- Pentest Lambda name: `cd infrastructure && terraform output -raw pentest_lambda_name`

## Manual deploy steps (optional, only if not using deploy_all.sh)

Use these only for debugging or partial reruns. Standard flow is `./scripts/deploy_all.sh`.

---

## Destroy

```bash
cd infrastructure
terraform destroy
```
