# ── CloudWatch Log Group (before task writes logs) ────────────────────────────

resource "aws_cloudwatch_log_group" "juiceshop" {
  name              = "/ecs/${var.project_name}-juiceshop"
  retention_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-logs"
  })
}

# ── ECS Task Definition for Juice Shop ───────────────────────────────────────

resource "aws_ecs_task_definition" "juiceshop" {
  family                   = "${var.project_name}-juiceshop"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = data.aws_iam_role.ecs_task_execution.arn

  depends_on = [aws_cloudwatch_log_group.juiceshop]

  container_definitions = jsonencode([
    {
      name      = "juiceshop"
      image     = "bkimminich/juice-shop:latest"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.project_name}-juiceshop"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "juiceshop"
        }
      }
    }
  ])

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-taskdef"
  })
}

# ── Security Group for Juice Shop ─────────────────────────────────────────────

resource "aws_security_group" "juiceshop" {
  name        = "${var.project_name}-juiceshop-sg"
  description = "Allow traffic to Juice Shop"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.juiceshop_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-sg"
  })
}

resource "aws_security_group" "juiceshop_alb" {
  name        = "${var.project_name}-juiceshop-alb-sg"
  description = "Allow HTTP to Juice Shop ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-alb-sg"
  })
}

# ── ALB for Juice Shop ────────────────────────────────────────────────────────

resource "aws_lb" "juiceshop" {
  name               = "${var.project_name}-juiceshop-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.juiceshop_alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-alb"
  })
}

resource "aws_lb_target_group" "juiceshop" {
  name        = "${var.project_name}-juiceshop-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-tg"
  })
}

resource "aws_lb_listener" "juiceshop" {
  load_balancer_arn = aws_lb.juiceshop.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.juiceshop.arn
  }
}

# ── ECS Service for Juice Shop (always running) ───────────────────────────────

resource "aws_ecs_service" "juiceshop" {
  name            = "${var.project_name}-juiceshop-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.juiceshop.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  network_configuration {
    subnets          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups  = [aws_security_group.juiceshop.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.juiceshop.arn
    container_name   = "juiceshop"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.juiceshop]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-service"
  })
}

# ── Output Juice Shop URL ─────────────────────────────────────────────────────

output "juiceshop_url" {
  description = "Juice Shop URL — use this as TARGET_URL for pentest"
  value       = "http://${aws_lb.juiceshop.dns_name}"
}