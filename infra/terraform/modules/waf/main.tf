resource "aws_wafv2_web_acl" "main" {
  name        = "vaeloom-${var.environment}-waf"
  description = "Vaeloom ${var.environment} WAF ACL"
  scope       = var.scope

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 0
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
    priority = 1
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
    priority = 2
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
    priority = 3
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
    name     = "ip-blocklist"
    priority = 4
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

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_arns = [var.log_group_arn]
  resource_arn         = aws_wafv2_web_acl.main.arn
}
