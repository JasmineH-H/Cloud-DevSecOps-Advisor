# For leanrner lab use LabRole
data "aws_iam_role" "ecs_task_execution" {
  name = "LabRole"
}

data "aws_secretsmanager_secret" "pentest" {
  name = "devsecops/pentest"
}

data "aws_secretsmanager_secret" "sast" {
  name = "devsecops/sast"
}