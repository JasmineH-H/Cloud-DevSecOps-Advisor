# End-to-end: AWS + Terraform + containers

Use this order. **Yes — you need Terraform first** to create VPC, ALB, ECS, ECR, DynamoDB, S3, Lambda, and Juice Shop. After that you **build and push Docker images** and **refresh the ECS service** so tasks pull `:latest`.

---

## 0. Prerequisites (Learner Lab)

1. Install [Terraform](https://www.terraform.io/downloads) and [AWS CLI](https://aws.amazon.com/cli/).
2. Configure credentials **every time the lab session rotates**:

```bash
aws configure
# Access Key ID, Secret Access Key, Session Token, region us-east-1, output json
```

Or export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`.

3. **Secrets Manager** — Terraform only *reads* these names (see `iam.tf`). Create them **before** `terraform apply`:

| Secret name        | Value (plain text) |
|--------------------|--------------------|
| `devsecops/pentest` | Same string as Bearer token for `POST /ingest/pentest` |
| `devsecops/sast`    | Same string as Bearer token for `POST /ingest/sast`   |

Use the AWS console: **Secrets Manager → Store a new secret → Other type of secret → Plaintext**.

4. **IAM role name** — This project expects the Learner Lab role **`LabRole`** (see `iam.tf`). If your account uses a different execution role for ECS, change `data.aws_iam_role.ecs_task_execution` in `iam.tf`.

---

## 1. Deploy infrastructure

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

Optional: copy `terraform.tfvars.example` to `terraform.tfvars` and set `pentest_target_url` only if you **do not** want to scan the **Juice Shop** ALB created in this stack. By default, pentest uses `http://<juiceshop-alb-dns>` automatically.

---

## 2. Push Docker images to ECR

Terraform creates two repos: **backend** (Advisor API) and **pentest** (scan tool). Get account and URLs:

```bash
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
cd infrastructure
BACKEND_ECR=$(terraform output -raw backend_ecr_url)
PENTEST_ECR=$(terraform output -raw pentest_ecr_url)
cd ..
```

Log in to ECR:

```bash
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
```

### Advisor backend (this repo `backend/`)

```bash
docker buildx build --platform linux/amd64 -t "${BACKEND_ECR}:latest" --push ./backend
```

### Pentest runner ([SAST-Pentest-Tool](https://github.com/JasmineH-H/SAST-Pentest-Tool) — use the `pentest/` directory where its `Dockerfile` lives)

```bash
# clone the scan tool repo, then from its pentest/ folder (adjust if Dockerfile path differs):
cd /path/to/SAST-Pentest-Tool/pentest
docker buildx build --platform linux/amd64 -t "${PENTEST_ECR}:latest" --push .
```

---

## 3. Force ECS to deploy new images

After the first push, tasks may still fail until the service pulls the new image:

```bash
cd infrastructure
CLUSTER=$(terraform output -raw ecs_cluster_name)
SERVICE=$(terraform output -raw ecs_service_name)
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --region "$AWS_REGION"
```

---

## 4. Verify API

```bash
ALB=$(terraform output -raw alb_dns_name)
curl -s "http://${ALB}/health"
```

---

## 5. Frontend (dashboard)

Point the UI at the **same ALB** as the API (browser calls ALB, not localhost).

```bash
cd frontend
echo "VITE_API_URL=http://${ALB}" > .env
npm install
npm run build
```

Upload `frontend/dist` to your S3 static website bucket (or run `npm run dev` locally with `VITE_API_URL=http://localhost:3000` while testing the backend on the laptop).

---

## 6. Optional checks

- **Juice Shop URL** (pentest target when `pentest_target_url` is empty): `terraform output juiceshop_url`
- **Manual pentest Lambda**: invoke `terraform output -raw pentest_lambda_name` from the console or CLI (schedule is daily in `pentest.tf`).

---

## Destroy

```bash
cd infrastructure
terraform destroy
```

(Typo fixed: **Destroy**, not “Destory”.)
