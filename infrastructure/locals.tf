# Define local values for the project

locals {
  az1 = data.aws_availability_zones.available.names[0]
  az2 = data.aws_availability_zones.available.names[1]

  common_tags = {
    Project = var.project_name
    Stage   = "week1"
    Managed = "terraform"
  }

  # One apply works: pentest uses Juice Shop in this VPC unless you set var.pentest_target_url
  pentest_target_url_effective = var.pentest_target_url != "" ? var.pentest_target_url : "http://${aws_lb.juiceshop.dns_name}"
}