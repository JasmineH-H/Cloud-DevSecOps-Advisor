# End-to-end: AWS + Terraform + containers

Run these commands from the repo root: `Cloud-DevSecOps-Advisor/`.

---

## STEP 1: Prerequisites (before Terraform)

1. Install [Terraform](https://www.terraform.io/downloads), [AWS CLI](https://aws.amazon.com/cli/), Docker, Node.js, and [GitHub CLI (`gh`)](https://cli.github.com/).

2. Configure AWS credentials (Learner Lab rotates tokens):
```bash
aws configure
# Access Key ID, Secret Access Key, Session Token, region us-east-1, output json
```

3. Authenticate GitHub CLI:
```bash
gh auth login
```

4. Create Secrets Manager secrets used by Terraform:
```bash
./scripts/setup-secrets.sh
```

This script securely prompts for token values (no echo), writes plaintext secret strings to AWS Secrets Manager, and prints the next GitHub setup checklist. Run this before `terraform apply`.


Compatibility note:
- The pentest trigger now extracts the token from either plaintext or JSON-formatted Secrets Manager values before launching the ECS task.
- Plaintext token strings are still the recommended format.

| Secret name         | Value                                   |
| ------------------- | --------------------------------------- |
| `devsecops/sast`    | Token for `POST /ingest/sast`    |
| `devsecops/pentest` | Token for `POST /ingest/pentest` |

5. Ensure IAM role in this stack matches your lab role (`LabRole` by default in `iam.tf`).

6. Prepare the project GitHub repository link (`owner/repo`) and use the deployed app URL to run and schedule pentest; for dashboard demo purposes, use the Juice Shop API link (Terraform output: `juiceshop_url`) to run pentest scans.

---

## STEP 2: Run Terraform apply

From repo root:

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

---

## Optional Step: Get values from Terraform outputs

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

## STEP 3: Configure target GitHub repos

Run once per target repository after `terraform apply`:
Enable branch protection so failed SAST blocks merges into the desired branch by entering [protected_branch_name]

```bash
./scripts/setup-target-repo.sh owner/repo --protect-branch [protected_branch_name]
./scripts/setup-target-workflow.sh owner/repo
```

What `setup-target-repo.sh` does:

- Secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
  - `INGEST_TOKEN_SAST`
  - `INGEST_TOKEN_PENTEST`
- Variables:
  - `BACKEND_API_URL` (from Terraform `alb_dns_name`)
  - `S3_BUCKET` (from Terraform `reports_s3_bucket`)


What `setup-target-workflow.sh` does:

- Creates/updates `.github/workflows/sast.yml` in the target repo with the reusable SAST workflow configuration.

Manual fallback:

- `Settings -> Secrets and variables -> Actions` on each target repo.

---
## STEP 4: Deploy application (default path)

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

What `deploy_all.sh` does for you:

- Runs Terraform apply
- Reads Terraform outputs
- Optionally logs in to ECR, builds/pushes backend image, and forces ECS backend redeploy
- Optionally builds/pushes the pentest image from `scanner/pentest`
- Optionally builds and syncs frontend to S3

Verify (optional):

```bash
cd infrastructure
ALB_DNS=$(terraform output -raw alb_dns_name)
curl -s "http://${ALB_DNS}/health"
terraform output -raw frontend_website_url
```
---

## Optional Checks:

- Juice Shop URL: `cd infrastructure && terraform output -raw juiceshop_url`
- Pentest Lambda name: `cd infrastructure && terraform output -raw pentest_lambda_name`

---

## Destroy

```bash
cd infrastructure
terraform destroy
```
