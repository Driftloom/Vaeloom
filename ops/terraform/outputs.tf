# ─── Vaeloom Production Terraform Outputs ──────────────────────────────

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "vpc_public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "alb_dns_name" {
  description = "ALB DNS name (use for CNAME or Route53 alias)"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "web_target_group_arn" {
  description = "Web service target group ARN"
  value       = aws_lb_target_group.web.arn
}

output "backend_target_group_arn" {
  description = "Backend API target group ARN"
  value       = aws_lb_target_group.backend.arn
}

output "web_service_url" {
  description = "Production web application URL"
  value       = "https://${var.domain_name}"
}

output "api_service_url" {
  description = "Production API endpoint URL"
  value       = "https://api.${var.domain_name}"
}

output "cdn_domain_name" {
  description = "CloudFront CDN domain name"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "cdn_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.cdn.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL primary endpoint (use with PgBouncer)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "rds_reader_endpoint" {
  description = "RDS PostgreSQL reader endpoint (read replicas)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.postgres.db_name
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "ElastiCache Redis reader endpoint"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
  sensitive   = true
}

output "s3_uploads_bucket" {
  description = "S3 bucket name for file uploads"
  value       = aws_s3_bucket.uploads.id
}

output "s3_uploads_bucket_arn" {
  description = "S3 bucket ARN for uploads"
  value       = aws_s3_bucket.uploads.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecr_web_repository_url" {
  description = "ECR repository URL for web service images"
  value       = aws_ecr_repository.web.repository_url
}

output "ecr_backend_repository_url" {
  description = "ECR repository URL for backend service images"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution IAM role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ECS task IAM role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "waf_acl_arn" {
  description = "WAF web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}
