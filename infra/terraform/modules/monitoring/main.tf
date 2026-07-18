locals {
  service_names = concat(var.app_services, var.micro_services)
}

resource "aws_cloudwatch_log_group" "services" {
  for_each          = toset(local.service_names)
  name              = "/vaeloom/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_id
  tags              = { Name = "/vaeloom/${var.environment}/${each.key}" }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "vaeloom-${var.environment}"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", { stat = "Average" }],
            ["AWS/ECS", "MemoryUtilization", { stat = "Average" }],
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Vaeloom ${var.environment} - ECS CPU & Memory"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", { stat = "Sum" }],
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Vaeloom ${var.environment} - ALB Requests & Latency"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", { stat = "Average" }],
            ["AWS/RDS", "ReadLatency", { stat = "Average" }],
            ["AWS/RDS", "WriteLatency", { stat = "Average" }],
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Vaeloom ${var.environment} - RDS Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", { stat = "Average" }],
            ["AWS/ElastiCache", "CacheHits", { stat = "Sum" }],
            ["AWS/ElastiCache", "CacheMisses", { stat = "Sum" }],
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Vaeloom ${var.environment} - ElastiCache"
        }
      },
    ]
  })
}

resource "aws_sns_topic" "alerts" {
  name = "vaeloom-${var.environment}-alerts"
  tags = { Name = "vaeloom-${var.environment}-alerts" }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = length(var.alert_emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_emails[count.index]
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "vaeloom-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "High CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "vaeloom-${var.environment}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "High memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
