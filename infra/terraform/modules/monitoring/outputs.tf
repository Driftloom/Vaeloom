output "log_group_names" {
  value = { for k, lg in aws_cloudwatch_log_group.services : k => lg.name }
}
output "alert_topic_arn" { value = aws_sns_topic.alerts.arn }
