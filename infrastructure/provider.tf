# Configure the AWS Provider with the variable region
provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {}