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

resource "aws_iam_role_policy" "ecs_read_secrets" {
  name = "${var.project_name}-ecs-read-secrets"
  role = data.aws_iam_role.ecs_task_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          data.aws_secretsmanager_secret.pentest.arn,
          data.aws_secretsmanager_secret.sast.arn
        ]
      }
    ]
  })
}