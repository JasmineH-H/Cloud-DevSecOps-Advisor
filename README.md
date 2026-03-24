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

### Scan Tool
https://github.com/JasmineH-H/SAST-Pentest-Tool.git