# Cloud DevSecOps Security Advisor - Backend API
This service ingests SAST and pentest scan results, stores scan metadata in DynamoDB, uploads full reports to S3, and provides APIs for the dashboard.

## Run locally

```bash
npm install
npm run dev
```

## Build Docker image (for ECS / Fargate)

Make sure to build for the correct platform (linux/amd64) to avoid architecture mismatch errors when deploying to ECS:

```bash
docker buildx build --platform linux/amd64 -t devsecops-backend ./backend
```

## Current endpoints

```bash
GET /health
```