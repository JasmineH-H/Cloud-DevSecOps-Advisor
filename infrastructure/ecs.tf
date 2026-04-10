# ECR for the Advisor API (this repo's backend/ — ingest + dashboard APIs)
resource "aws_ecr_repository" "backend" {
  name         = "${var.project_name}-backend"
  force_delete = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-backend-ecr"
  })
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-backend-logs"
  })
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-cluster"
  })
}

# Long-running service: Node backend (SAST/pentest ingest, DynamoDB, S3).
# Build/push image from Cloud-DevSecOps-Advisor/backend (not SAST-Pentest-Tool).
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = data.aws_iam_role.ecs_task_execution.arn
  task_role_arn            = data.aws_iam_role.ecs_task_execution.arn

  depends_on = [aws_cloudwatch_log_group.backend]

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      secrets = [
        {
          name      = "INGEST_TOKEN_SAST"
          valueFrom = data.aws_secretsmanager_secret.sast.arn
        },
        {
          name      = "INGEST_TOKEN_PENTEST"
          valueFrom = data.aws_secretsmanager_secret.pentest.arn
        }
      ]

      environment = [
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "SCAN_RESULTS_TABLE"
          value = aws_dynamodb_table.scan_results.name
        },
        {
          name  = "REPORTS_BUCKET"
          value = aws_s3_bucket.reports.bucket
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.project_name}-backend"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "backend"
        }
      }
    }
  ])

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-taskdef"
  })
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  launch_type     = "FARGATE"
  desired_count   = var.desired_count

  network_configuration {
    subnets          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-backend-service"
  })
}