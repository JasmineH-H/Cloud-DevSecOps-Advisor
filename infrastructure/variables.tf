# Define the variable for inputs

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "devsecops-advisor"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_a_cidr" {
  description = "CIDR block for public subnet A"
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_b_cidr" {
  description = "CIDR block for public subnet B"
  type        = string
  default     = "10.0.2.0/24"
}

variable "private_subnet_a_cidr" {
  description = "CIDR block for private subnet A"
  type        = string
  default     = "10.0.11.0/24"
}

variable "private_subnet_b_cidr" {
  description = "CIDR block for private subnet B"
  type        = string
  default     = "10.0.12.0/24"
}

variable "container_port" {
  description = "Port exposed by the backend container"
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "Fargate task CPU"
  type        = string
  default     = "256"
}

variable "task_memory" {
  description = "Fargate task memory"
  type        = string
  default     = "512"
}

variable "desired_count" {
  description = "Desired ECS service task count"
  type        = number
  default     = 1
}

variable "sast_secret_name" {
  description = "Secrets Manager secret name for the SAST ingest token"
  type        = string
  default     = "devsecops/sast"
}

variable "pentest_secret_name" {
  description = "Secrets Manager secret name for the pentest ingest token"
  type        = string
  default     = "devsecops/pentest"
}

variable "pentest_target_url" {
  description = "Optional override for pentest TARGET_URL. Leave empty to use the Juice Shop ALB deployed in this stack (see juiceshop_url output)."
  type        = string
  default     = ""
}

variable "pentest_repo_name" {
  description = "Repo label for tagging pentest results"
  type        = string
  default     = "vulnerable-node-app"
}

variable "iam_role_name" {
  description = "IAM role name used by ECS tasks and the pentest Lambda"
  type        = string
  default     = "LabRole"
}

variable "create_runtime_role" {
  description = "Whether Terraform should create the runtime IAM role used by ECS tasks and the pentest Lambda"
  type        = bool
  default     = true
}

variable "scan_results_table_name" {
  description = "Optional DynamoDB table name for scan results. Leave empty to use <project_name>-scan-results."
  type        = string
  default     = ""
}

variable "alb_certificate_arn" {
  description = "Optional ACM certificate ARN. When set, ALB serves HTTPS on 443 and redirects HTTP to HTTPS."
  type        = string
  default     = ""
}

variable "s3_force_destroy" {
  description = "Whether S3 buckets can be force-deleted with all objects during terraform destroy."
  type        = bool
  default     = false
}
