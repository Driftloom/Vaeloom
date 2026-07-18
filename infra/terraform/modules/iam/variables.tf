variable "environment" { type = string }
variable "eks_cluster_arn" { type = string }
variable "ecr_repository_arns" { type = list(string), default = [] }
variable "s3_bucket_arn" { type = string, default = "" }
variable "kms_key_arn" { type = string, default = "" }
