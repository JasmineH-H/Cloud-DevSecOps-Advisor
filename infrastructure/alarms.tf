resource "aws_cloudwatch_metric_alarm" "ecs_backend_running_tasks_low" {
  alarm_name          = "${var.project_name}-backend-running-tasks-low"
  alarm_description   = "Backend ECS running task count is below desired."
  namespace           = "AWS/ECS"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 2
  threshold           = max(var.desired_count - 1, 0)
  comparison_operator = "LessThanOrEqualToThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-backend-running-tasks-low"
  })
}

resource "aws_cloudwatch_metric_alarm" "ecs_juiceshop_running_tasks_low" {
  alarm_name          = "${var.project_name}-juiceshop-running-tasks-low"
  alarm_description   = "Juice Shop ECS running task count is below expected."
  namespace           = "AWS/ECS"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "LessThanOrEqualToThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.juiceshop.name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-juiceshop-running-tasks-low"
  })
}

resource "aws_cloudwatch_metric_alarm" "lambda_pentest_errors" {
  alarm_name          = "${var.project_name}-pentest-lambda-errors"
  alarm_description   = "Pentest trigger Lambda is returning errors."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.pentest_trigger.function_name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-pentest-lambda-errors"
  })
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttle" {
  alarm_name          = "${var.project_name}-dynamodb-read-throttle"
  alarm_description   = "DynamoDB read throttling detected."
  namespace           = "AWS/DynamoDB"
  metric_name         = "ReadThrottleEvents"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.scan_results.name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-dynamodb-read-throttle"
  })
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttle" {
  alarm_name          = "${var.project_name}-dynamodb-write-throttle"
  alarm_description   = "DynamoDB write throttling detected."
  namespace           = "AWS/DynamoDB"
  metric_name         = "WriteThrottleEvents"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.scan_results.name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-dynamodb-write-throttle"
  })
}
