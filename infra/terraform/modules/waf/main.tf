resource "aws_wafv2_web_acl" "main" {
  name        = "vaeloom-${var.environment}-waf"
  description = "Vaeloom ${var.environment} WAF ACL"
  scope       = var.scope

  default_action {
    allow {}
  }

  rule {
    name     = "auth-brute-force-shield"
    priority = 0
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.auth_rate_limit
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            search_string = "/api/v1/auth/"
            field_to_match {
              uri_path {}
            }
            positional_constraint = "STARTS_WITH"
            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-auth-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "sql-injection-protection"
    priority = 2
    action {
      block {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-sqli"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "xss-protection"
    priority = 3
    action {
      block {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesXssRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-xss"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "common-exploits"
    priority = 4
    action {
      block {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "known-bad-inputs"
    priority = 5
    action {
      block {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "ip-blocklist"
    priority = 6
    action {
      block {}
    }
    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blocklist.arn
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "vaeloom-${var.environment}-ip-block"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "vaeloom-${var.environment}-waf"
    sampled_requests_enabled   = true
  }

  tags = { Name = "vaeloom-${var.environment}-waf" }
}

resource "aws_wafv2_ip_set" "blocklist" {
  name               = "vaeloom-${var.environment}-blocklist"
  description        = "IP blocklist for Vaeloom ${var.environment}"
  scope              = var.scope
  ip_address_version = "IPV4"
  addresses          = var.ip_blocklist
}

# WAF log delivery: CLOUDFRONT scope accepts ONLY Kinesis Firehose
# destinations (a CloudWatch/SNS ARN here fails at apply — the previous
# log_group_arn wiring). When log_bucket_arn is set, ship via Firehose to
# S3; otherwise no logging configuration is created.
resource "aws_iam_role" "firehose" {
  count = var.log_bucket_arn != "" ? 1 : 0
  name  = "vaeloom-${var.environment}-waf-firehose"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "firehose.amazonaws.com" }
    }]
  })
}

resource "aws_kinesis_firehose_delivery_stream" "waf_logs" {
  count       = var.log_bucket_arn != "" ? 1 : 0
  name        = "vaeloom-${var.environment}-waf-logs"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose[0].arn
    bucket_arn = var.log_bucket_arn
    prefix     = "waf/${var.environment}/"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count                  = var.log_bucket_arn != "" ? 1 : 0
  log_destination_arns   = [aws_kinesis_firehose_delivery_stream.waf_logs[0].arn]
  resource_arn           = aws_wafv2_web_acl.main.arn
}
