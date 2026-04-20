# Cloud DevSecOps Security Advisor

Cloud DevSecOps Security Advisor is an AWS-based platform that automates security testing and centralizes findings in a web dashboard.

It combines:

- SAST scanning on repository code changes
- Scheduled API penetration testing
- Centralized storage and visualization of security findings

## Overview

This project is designed to help teams shift security earlier in the delivery lifecycle without creating manual security bottlenecks.

When new code is pushed:

1. CI triggers security scans.
2. Scan results are ingested by the backend API.
3. Metadata and artifacts are stored in AWS services.
4. The frontend dashboard presents current and historical risk trends.

## Core Capabilities

- Automatic SAST ingestion pipeline
- Scheduled pentest trigger and result ingestion
- Risk scoring and findings aggregation
- Dashboard views for scan history, vulnerabilities, and controls
- Infrastructure-as-code deployment with Terraform

## Architecture

- Frontend: React + Vite, hosted on S3 static website hosting
- Backend API: Node.js + Express, deployed on ECS Fargate
- Entry point: Application Load Balancer (ALB)
- Data layer:
  - DynamoDB for scan metadata
  - S3 for report artifacts
- Security workers:
  - Containerized SAST service
  - Containerized pentest service
  - Lambda pentest trigger integration

## Tech Stack

- Frontend: React 19, Vite, Axios
- Backend: Node.js 20+, Express 5
- Cloud: AWS (ECS, ALB, S3, DynamoDB, Lambda, VPC, IAM)
- CI/CD: GitHub Actions
- Containers: Docker
- IaC: Terraform

## Repository Structure

- `frontend/`: Dashboard UI
- `backend/`: Ingest and query API
- `scanner/`: SAST and pentest scanner services
- `lambda/`: Pentest trigger Lambda
- `infrastructure/`: Terraform modules for cloud resources
- `scripts/`: Deployment and setup helper scripts

## Setup Instructions

For complete setup, deployment, and teardown instructions, refer to [SETUP.md](SETUP.md).

This includes:

- Required prerequisites (AWS CLI, Terraform, Docker, Node.js, gh)
- Secrets configuration
- Terraform apply workflow
- GitHub repository integration scripts
- End-to-end deployment commands

## Typical Workflow

1. Provision infrastructure with Terraform.
2. Configure target repositories and secrets.
3. Deploy backend, scanner images, and frontend.
4. Trigger scans via CI or scheduler.
5. Review findings and risk posture in the dashboard.

## Notes

- This repo contains infrastructure state files for local/testing use.
- Review security-sensitive scripts and IAM settings before using in production.
