# Cloud DevSecOps Security Advisor

A cloud-based security platform that automatically runs SAST and API penetration testing on code changes and aggregates results into a centralized dashboard.

## Overview

Modern development teams struggle to maintain continuous security without slowing down delivery.
This project provides an automated DevSecOps pipeline that integrates security scanning directly into the development workflow.

Key features:

- Automatic SAST scanning on every code push
- Scheduled API penetration testing
- Centralized dashboard for tracking vulnerabilities and trends

## Architecture

The system is built using AWS cloud services with a modular design:

- Frontend: S3 static website hosting
- Backend: Node.js API on ECS Fargate
- Load Balancer: Application Load Balancer (ALB)
- Data Storage: DynamoDB + S3
- Scanners: Containerized SAST and Pentest services

## Tech Stack

- Frontend: React, Tailwind CSS
- Backend: Node.js (Express)
- Cloud: AWS (ECS, ALB, S3, DynamoDB, VPC)
- CI/CD: GitHub Actions
- Containers: Docker
- IaC: Terraform

## Workflow

1. Developer pushes code to GitHub
2. GitHub Actions triggers SAST scan
3. Results are sent to backend API
4. Backend stores results in DynamoDB and S3
5. Dashboard fetches and displays results
6. Scheduled pentest runs periodically via ECS tasks

## Additional Required Repos:

### vulnerable-demo-app

https://github.com/JasmineH-H/vulnerable-node-app.git

### Scanner Code

The SAST and pentest tooling now lives in this repository under `scanner/`.

#### Build and Push the Pentest Docker Image

Before triggering the pentest pipeline, ensure that the pentest Docker image is available in Amazon ECR.  
If the image is missing, the ECS task will fail with `CannotPullContainerError`.

> Run the following steps from this repository root. The pentest Docker context is `scanner/pentest/`.

1. Get your AWS account ID

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo $ACCOUNT_ID
```

2. Log in to Amazon ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

3. Build the pentest image

```bash
docker buildx build \
  --platform linux/amd64 \
  -t $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/devsecops-advisor-pentest:latest \
  --push ./scanner/pentest
```

6. Verify that the image exists in ECR

```bash
aws ecr describe-images \
  --repository-name devsecops-advisor-pentest \
  --region us-east-1
```

## Deploy the Backend to AWS

The backend runs on ECS Fargate behind the application load balancer created by Terraform.

### 1. Confirm the required Secrets Manager entries exist

The infrastructure expects these AWS Secrets Manager names:

- `devsecops/sast`
- `devsecops/pentest`

### 2. Apply the infrastructure

```bash
cd infrastructure
terraform apply
```

### 3. Build and push the backend image to ECR

Use `linux/amd64` when building so ECS Fargate can pull the image correctly.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker buildx build \
  --platform linux/amd64 \
  -t $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/devsecops-advisor-backend:latest \
  ./backend \
  --push
```

### 4. Force ECS to pull the latest image

```bash
aws ecs update-service \
  --cluster devsecops-advisor-cluster \
  --service devsecops-advisor-backend-service \
  --force-new-deployment \
  --region us-east-1
```

### 5. Verify the backend is running

```bash
cd infrastructure
terraform output alb_dns_name
curl http://<alb-dns-name>/health
```

Expected response:

```json
{"success":true,"message":"Backend API is running"}
```
