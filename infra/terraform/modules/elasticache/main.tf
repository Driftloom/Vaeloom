resource "aws_elasticache_subnet_group" "main" {
  name       = "vaeloom-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name        = "vaeloom-${var.environment}-redis-sg"
  vpc_id      = var.vpc_id
  description = "Redis security group"
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "vaeloom-${var.environment}-redis"
  description          = "Vaeloom ${var.environment} Redis cluster"
  node_type            = var.node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  automatic_failover_enabled = var.environment == "prod" ? true : false
  multi_az_enabled           = var.environment == "prod" ? true : false

  engine         = "redis"
  engine_version = "7.1"

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true

  tags = { Name = "vaeloom-${var.environment}-redis" }
}
