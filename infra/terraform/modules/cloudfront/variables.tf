variable "environment" { type = string }
variable "s3_bucket_id" { type = string }
variable "s3_bucket_arn" { type = string }
variable "s3_bucket_domain" { type = string }
variable "domain_aliases" { type = list(string), default = [] }
variable "acm_certificate_arn" { type = string }
variable "waf_acl_arn" { type = string, default = null }
variable "price_class" { type = string, default = "PriceClass_100" }
variable "geo_restriction_type" { type = string, default = "none" }
variable "geo_restriction_locations" { type = list(string), default = [] }
