output "frontend_bucket_name" {
  description = "S3 bucket for dashboard frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_website_url" {
  description = "S3 static website URL for dashboard frontend"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "frontend_cloudfront_url" {
  description = "HTTPS CloudFront URL for dashboard frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "frontend_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for dashboard frontend"
  value       = aws_cloudfront_distribution.frontend.id
}

output "api_cloudfront_url" {
  description = "HTTPS CloudFront URL for backend API"
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "api_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for backend API"
  value       = aws_cloudfront_distribution.api.id
}
