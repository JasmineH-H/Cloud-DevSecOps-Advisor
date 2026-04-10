output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value = [
    aws_subnet.public_a.id,
    aws_subnet.public_b.id
  ]
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value = [
    aws_subnet.private_a.id,
    aws_subnet.private_b.id
  ]
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB"
  value       = aws_lb.backend.dns_name
}

output "backend_ecr_url" {
  description = "Push the Advisor API image here (from this repo's backend/ directory)"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}


output "reports_s3_bucket" {
  description = "S3 bucket name for scan reports"
  value       = aws_s3_bucket.reports.bucket
}