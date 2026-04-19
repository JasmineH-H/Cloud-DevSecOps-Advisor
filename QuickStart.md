## Overview

This project has two main parts in one repository plus target repositories: 1. Cloud-DevSecOps-Advisor
Hosts the backend API, infrastructure, dashboard frontend, and the scanner code under `scanner/`. 2. Target repositories
Example:
• juice-shop
• vulnerable-node-app

These target repositories run SAST and Pentest workflows and send results to the Advisor backend.

What you need before starting

You need:
• AWS Learner Lab access
• Docker Desktop running
• AWS CLI installed
• Terraform installed
• Node.js installed
• Access to the GitHub repositories
• GitHub Actions secrets/variables configured in the target repos

### Part 1 — Update AWS credentials

**Step 1: Get fresh AWS credentials**

Go to:
• AWS Academy Learner Lab
• Cloud Access
• AWS CLI

Copy the new credentials block.

It will look like this:

```
[default]
aws_access_key_id=EXAMPLEACCESSKEY
aws_secret_access_key=EXAMPLESECRETKEY
aws_session_token=EXAMPLESESSIONTOKEN
```

**Step 2: Replace local credentials**

On your machine, open terminal:

```
nano ~/.aws/credentials
```

Replace the old [default] block with the new one.

Save and exit:
• Ctrl + O
• press Enter
• Ctrl + X

### Part 2 — Cloud-DevSecOps-Advisor setup

**Step 1: Login to ECR**

Before building the backend image, log in to ECR:

```
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
```

You should see:
Login Succeeded

**Step 2: Deploy infrastructure with Terraform**

Go to the infrastructure folder:
bash```
cd infrastructure
terraform init
terraform validate
terraform apply

```
Type yes when prompted.

**Step 3: Check Terraform outputs**
After apply, run:
```

terraform output

```
Important outputs include:
	•	alb_dns_name
	•	frontend_bucket_name
	•	frontend_website_url
	•	backend_ecr_url
example:
alb_dns_name = "devsecops-advisor-alb-1871069195.us-east-1.elb.amazonaws.com"
frontend_bucket_name = "devsecops-advisor-frontend-<your-account-id>"
frontend_website_url = "devsecops-advisor-frontend-<your-account-id>.s3-website-us-east-1.amazonaws.com"

### Part 3 — Build and deploy backend

**Step 1: Build and push backend image**

From the backend folder:
```

cd ../backend
BACKEND_ECR=$(cd ../infrastructure && terraform output -raw backend_ecr_url)

docker buildx build \
 --platform linux/amd64 \
 -t "${BACKEND_ECR}:latest" \
 . \
 --push

````

**Step 2: Force ECS redeploy**

Go back to infrastructure:
```bash
cd ../infrastructure

aws ecs update-service \
  --cluster devsecops-advisor-cluster \
  --service devsecops-advisor-backend-service \
  --force-new-deployment \
  --region us-east-1
````

Wait for the service to stabilize:

```bash
aws ecs wait services-stable \
  --cluster devsecops-advisor-cluster \
  --services devsecops-advisor-backend-service \
  --region us-east-1
```

**Step 3: Verify backend health**

```
ALB=$(terraform output -raw alb_dns_name)
curl "http://${ALB}/health"
```

Expected result:
{"success":true,"message":"Backend API is running"}

### Part 4 — Build and upload frontend dashboard

**Step 1: Build frontend**
From the project root:

```
cd ../frontend
npm install
ALB=$(cd ../infrastructure && terraform output -raw alb_dns_name)
VITE_API_URL=http://${ALB} npm run build
```

This command uses your current Terraform `alb_dns_name`.

**Step 2: Upload to S3**

```
FRONTEND_BUCKET=$(cd ../infrastructure && terraform output -raw frontend_bucket_name)
aws s3 sync dist/ "s3://${FRONTEND_BUCKET}" --delete
```

This command uses your current Terraform `frontend_bucket_name`.

**Step 3: Open the dashboard**

Use the Terraform output: frontend_website_url
example: http://devsecops-advisor-frontend-<your-account-id>.s3-website-us-east-1.amazonaws.com

### Part 6 — Target repository setup

Example target repositories:
• juice-shop
• vulnerable-node-app

**Step 1: Add GitHub Actions secrets**

In each target repo, go to:
• Settings
• Secrets and variables
• Actions
• Secrets

Add:
• AWS_ACCESS_KEY_ID
• AWS_SECRET_ACCESS_KEY
• AWS_SESSION_TOKEN
• INGEST_TOKEN_SAST
• INGEST_TOKEN_PENTEST

**Step 2: Add GitHub Actions variables**

In each target repo, go to:
• Settings
• Secrets and variables
• Actions
• Variables

Add:
• BACKEND_API_URL
• S3_BUCKET
• TARGET_URL (required for Pentest)

Example values:
BACKEND_API_URL = http://<your-alb-dns-name>
S3_BUCKET = <terraform output -raw reports_s3_bucket>
TARGET_URL = http://PUBLIC-TARGET-APP-URL
