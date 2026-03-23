# For leanrner lab use LabRole
data "aws_iam_role" "ecs_task_execution" {
  name = "LabRole"
}