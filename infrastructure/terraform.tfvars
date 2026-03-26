aws_region            = "us-east-1"
project_name          = "devsecops-advisor"
vpc_cidr              = "10.0.0.0/16"
public_subnet_a_cidr  = "10.0.1.0/24"
public_subnet_b_cidr  = "10.0.2.0/24"
private_subnet_a_cidr = "10.0.11.0/24"
private_subnet_b_cidr = "10.0.12.0/24"
container_port        = 3000
task_cpu              = "256"
task_memory           = "512"
desired_count         = 1


ingest_token_sast    = "7f3b91d2c4a84e7e9a2d6b1f5c8e3a11"
ingest_token_pentest = "pt-7x$Km2#vQpL9nRdWj4YeHcBs6FgTuNzA"
pentest_repo_name    = "vulnerable-node-app"

# Testing with Juice Shop
pentest_target_url = "http://devsecops-advisor-juiceshop-alb-1714605733.us-east-1.elb.amazonaws.com"

# Later — point at any other app
# pentest_target_url = "http://<vulnerable-node-app-ALB-DNS>"