# Define local values for the project

locals {
  az1 = data.aws_availability_zones.available.names[0]
  az2 = data.aws_availability_zones.available.names[1]

  common_tags = {
    Project = var.project_name
    Stage   = "week1"
    Managed = "terraform"
  }
}