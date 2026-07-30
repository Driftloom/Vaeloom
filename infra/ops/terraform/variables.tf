# ─── Vaeloom Production Terraform Variables ─────────────────────────────

# ─── General ───────────────────────────────────────────────────────────
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "aws_region" {
  description = "AWS region for primary resources"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional resource tags"
  type        = map(string)
  default     = {}
}

# ─── Networking ────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AWS availability zones for multi-AZ deployment"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# ─── ECS Fargate ───────────────────────────────────────────────────────
variable "web_desired_count" {
  description = "Desired number of web service tasks"
  type        = number
  default     = 2
}

variable "web_max_count" {
  description = "Maximum number of web service tasks (autoscaling)"
  type        = number
  default     = 10
}

variable "web_cpu" {
  description = "CPU units for web Fargate task (256=0.25 vCPU, 512=0.5 vCPU, 1024=1 vCPU)"
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Memory (MiB) for web Fargate task"
  type        = number
  default     = 1024
}

variable "backend_desired_count" {
  description = "Desired number of backend service tasks"
  type        = number
  default     = 2
}

variable "backend_max_count" {
  description = "Maximum number of backend service tasks (autoscaling)"
  type        = number
  default     = 10
}

variable "backend_cpu" {
  description = "CPU units for backend Fargate task (1024=1 vCPU, 2048=2 vCPU)"
  type        = number
  default     = 2048
}

variable "backend_memory" {
  description = "Memory (MiB) for backend Fargate task"
  type        = number
  default     = 4096
}

# ─── RDS PostgreSQL ────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.3"
}

variable "db_parameter_group_family" {
  description = "RDS parameter group family"
  type        = string
  default     = "postgres16"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "vaeloom"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "vaeloom"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "RDS maximum allocated storage (autoscaling) in GB"
  type        = number
  default     = 500
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 30
}

# ─── ElastiCache Redis ─────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.small"
}

variable "redis_parameter_group_family" {
  description = "ElastiCache parameter group family"
  type        = string
  default     = "redis7"
}

variable "redis_num_cache_clusters" {
  description = "Number of Redis cache clusters (1 for dev, 2+ for prod with replicas)"
  type        = number
  default     = 2
}

# ─── DNS & Certificates ────────────────────────────────────────────────
variable "domain_name" {
  description = "Root domain name (e.g., vaeloom.app)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for ALB (must be in the deployment region)"
  type        = string
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)"
  type        = string
}
