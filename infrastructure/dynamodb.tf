resource "aws_dynamodb_table" "scan_results" {
  name         = local.scan_results_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "repo"
  range_key    = "timestamp"

  attribute {
    name = "repo"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "runId"
    type = "S"
  }

  global_secondary_index {
    name            = "runId-index"
    hash_key        = "runId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  tags = merge(local.common_tags, {
    Name = local.scan_results_table_name
  })
}

resource "aws_dynamodb_table" "scan_findings" {
  name         = "${var.project_name}-scan-findings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "runId"
  range_key    = "findingId"

  attribute {
    name = "runId"
    type = "S"
  }

  attribute {
    name = "findingId"
    type = "S"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-scan-findings"
  })
}
