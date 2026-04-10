output "frontend_bucket_name" {
  description = "S3 bucket for dashboard frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_website_url" {
  description = "S3 static website URL for dashboard frontend"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}