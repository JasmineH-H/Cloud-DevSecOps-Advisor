# AWS + Terraform Setup Guide

This guide explains how to configure AWS credentials and run Terraform for this project.

---

## Prerequisites

- Terraform installed
- AWS account (AWS Learner Lab for this project)
- AWS CLI installed

---

## 1. Configure AWS CLI
``` bash
aws configure
```
### Enter
``` bash
AWS Access Key ID:     <your access key>
AWS Secret Access Key: <your secret key>
AWS Session Token： <your session token>
Default region name:   us-east-1
Default output format: json
```

## 2. Deploy Infrastructure with Terraform
``` bash
cd infrastructure

terraform init -reconfigure
terraform validate
terraform plan
terraform apply
```

## 3. Destory Infrastructure
``` bash
terraform destroy
```