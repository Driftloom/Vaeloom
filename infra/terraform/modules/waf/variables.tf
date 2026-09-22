variable "environment" { type = string }
variable "scope" { type = string, default = "CLOUDFRONT" }
variable "rate_limit" { type = number, default = 2000 }
variable "auth_rate_limit" {
  type        = number
  default     = 100
  description = "5-minute per-IP budget for /api/v1/auth/* (brute-force shield)"
}
variable "ip_blocklist" { type = list(string), default = [] }
variable "log_group_arn" {
  type        = string
  default     = ""
  description = "Legacy: only valid for REGIONAL scope (CloudWatch Log Group ARN). Prefer log_bucket_arn."
}
variable "log_bucket_arn" {
  type        = string
  default     = ""
  description = "S3 bucket ARN for WAF log delivery via Kinesis Firehose (required for CLOUDFRONT scope). Empty = no logging configuration."
}
