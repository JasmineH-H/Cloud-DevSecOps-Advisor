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

## How to run everything (Terraform → Docker → ECS → frontend)

See **[infrastructure/INFRASTRUCTURE.md](infrastructure/INFRASTRUCTURE.md)** for the full order: AWS credentials, Secrets Manager, `terraform apply`, push **backend** and **pentest** images to ECR, force ECS deployment, then build the frontend with `VITE_API_URL` pointing at the ALB.

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

### Scan Tool

https://github.com/JasmineH-H/SAST-Pentest-Tool.git

#### Build and Push the Pentest Docker Image

Before triggering the pentest pipeline, ensure that the pentest Docker image is available in Amazon ECR.  
If the image is missing, the ECS task will fail with `CannotPullContainerError`.

> Run the following steps from the **Scan Tool repository root directory** (where the `pentest/` folder is located).

1. Get your AWS account ID

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo $ACCOUNT_ID
```

2. Log in to Amazon ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

3. Build the pentest image from the **`pentest/`** folder of SAST-Pentest-Tool (where its Dockerfile lives). Use **your** account and `terraform output -raw pentest_ecr_url` for the tag.

```bash
docker buildx build \
  --platform linux/amd64 \
  -t "${PENTEST_ECR}:latest" \
  --push .
```

6. Verify that the image exists in ECR

```bash
aws ecr describe-images \
  --repository-name devsecops-advisor-pentest \
  --region us-east-1
```
