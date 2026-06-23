data "aws_iam_role" "ecs_task_execution" {
  count = var.create_runtime_role ? 0 : 1
  name  = var.iam_role_name
}

# Optional: create the runtime role in this account when requested
resource "aws_iam_role" "runtime" {
  count = var.create_runtime_role ? 1 : 0
  name  = var.iam_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = ["ecs-tasks.amazonaws.com", "lambda.amazonaws.com"]
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "runtime_policy" {
  count = var.create_runtime_role ? 1 : 0
  name  = "${var.iam_role_name}-inline-runtime"
  role  = aws_iam_role.runtime[0].name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid      = "Logs",
        Effect   = "Allow",
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Resource = "*"
      },
      {
        Sid      = "S3Access",
        Effect   = "Allow",
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
        Resource = "*"
      },
      {
        Sid      = "DynamoDBAccess",
        Effect   = "Allow",
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem"],
        Resource = "*"
      },
      {
        Sid      = "SecretsManagerRead",
        Effect   = "Allow",
        Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
        Resource = "*"
      },
      {
        Sid      = "ECRPull",
        Effect   = "Allow",
        Action   = ["ecr:GetAuthorizationToken", "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
        Resource = "*"
      },
      {
        Sid      = "ECSRunPentestTask",
        Effect   = "Allow",
        Action   = ["ecs:RunTask"],
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${var.project_name}-pentest:*"
      },
      {
        Sid      = "ECSDescribeTasks",
        Effect   = "Allow",
        Action   = ["ecs:DescribeTasks"],
        Resource = "*"
      },
      {
        Sid    = "LambdaInvoke",
        Effect = "Allow",
        Action = [
          "lambda:InvokeFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:AddPermission"
        ],
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}*"
      },
      {
        Sid    = "EventBridgeScheduleManagement",
        Effect = "Allow",
        Action = [
          "events:PutRule",
          "events:DisableRule",
          "events:PutTargets",
          "events:DescribeRule",
          "events:ListTargetsByRule"
        ],
        Resource = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:rule/${var.project_name}*"
      },
      {
        Sid      = "PassRole",
        Effect   = "Allow",
        Action   = ["iam:PassRole"],
        Resource = "*"
      }
    ]
  })
}

locals {
  runtime_role_arn = var.create_runtime_role ? aws_iam_role.runtime[0].arn : data.aws_iam_role.ecs_task_execution[0].arn
}

data "aws_secretsmanager_secret" "pentest" {
  name = "devsecops/pentest"
}

data "aws_secretsmanager_secret" "sast" {
  name = "devsecops/sast"
}
