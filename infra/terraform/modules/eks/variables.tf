variable "environment" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "cluster_version" { type = string }
variable "node_instance_types" { type = list(string) }
variable "node_group_min_size" { type = number }
variable "node_group_max_size" { type = number }
variable "node_group_desired_size" { type = number }
