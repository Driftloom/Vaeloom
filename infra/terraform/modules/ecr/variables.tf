variable "environment" { type = string }
variable "app_repositories" { type = list(string) }
variable "service_repositories" { type = list(string) }
variable "eks_node_role_arn" { type = string }
