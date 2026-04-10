resource "aws_dynamodb_table" "scan_results" {
  name         = "ScanResults"
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
    projection_type = "ALL"
  }

  tags = merge(local.common_tags, {
    Name = "ScanResults"
  })
}
