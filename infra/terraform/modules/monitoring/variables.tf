variable "environment" { type = string }
variable "aws_region" { type = string }
variable "app_services" { type = list(string) }
variable "micro_services" { type = list(string) }
variable "log_retention_days" { type = number, default = 30 }
variable "kms_key_id" { type = string, default = null }
variable "alert_emails" { type = list(string), default = [] }
