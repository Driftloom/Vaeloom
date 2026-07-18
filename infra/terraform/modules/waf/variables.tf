variable "environment" { type = string }
variable "scope" { type = string, default = "CLOUDFRONT" }
variable "rate_limit" { type = number, default = 2000 }
variable "ip_blocklist" { type = list(string), default = [] }
variable "log_group_arn" { type = string }
