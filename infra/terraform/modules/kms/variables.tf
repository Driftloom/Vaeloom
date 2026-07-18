variable "environment" { type = string }
variable "rotation_period_days" { type = number, default = 90 }
variable "deletion_window_days" { type = number, default = 30 }
variable "multi_region" { type = bool, default = false }
