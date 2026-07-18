variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AWS availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.29"
}

variable "node_instance_types" {
  description = "EC2 instance types for EKS node groups"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_group_min_size" {
  description = "Minimum node group size"
  type        = number
  default     = 2
}

variable "node_group_max_size" {
  description = "Maximum node group size"
  type        = number
  default     = 10
}

variable "node_group_desired_size" {
  description = "Desired node group size"
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "enable_monitoring" {
  description = "Enable detailed monitoring"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

variable "app_repositories" {
  description = "Application ECR repository names"
  type        = list(string)
  default     = ["web", "api", "ai-service"]
}

variable "service_repositories" {
  description = "Microservice ECR repository names"
  type        = list(string)
  default = [
    "memory-store", "auth-service", "knowledge-graph", "event-bus",
    "search-service", "agent-engine", "analytics-service", "audit-service",
    "billing-service", "connector-service", "document-ingestion", "iam-service",
    "integration-service", "job-scheduler", "notification-service", "plugin-service",
    "rbac-service", "recommendation-service",
  ]
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "vaeloom.dev"
}

variable "domain_aliases" {
  description = "Additional domain aliases"
  type        = list(string)
  default     = ["*.vaeloom.dev"]
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront"
  type        = string
  default     = ""
}

variable "alert_emails" {
  description = "Alert email recipients"
  type        = list(string)
  default     = []
}
