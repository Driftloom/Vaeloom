# ─── Vaeloom Production Terraform (ECS Fargate + RDS + Redis + ALB + CDN) ──

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  backend "s3" {
    bucket         = "vaeloom-terraform-state"
    key            = "vaeloom/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "vaeloom-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "Vaeloom"
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ─── VPC ───────────────────────────────────────────────────────────────────
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = "vaeloom-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment == "prod" ? false : true
  enable_dns_hostnames   = true
  enable_dns_support     = true

  manage_default_security_group = false

  tags = var.tags
}

# ─── Security Groups ───────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "vaeloom-${var.environment}-alb"
  description = "Application Load Balancer security group"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_security_group" "ecs_tasks" {
  name        = "vaeloom-${var.environment}-ecs-tasks"
  description = "ECS tasks security group"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Traffic from ALB"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "Allow tasks within the same group"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_security_group" "rds" {
  name        = "vaeloom-${var.environment}-rds"
  description = "RDS security group"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = var.tags
}

resource "aws_security_group" "redis" {
  name        = "vaeloom-${var.environment}-redis"
  description = "ElastiCache Redis security group"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = var.tags
}

# ─── S3 Bucket (File Uploads) ──────────────────────────────────────────────
resource "aws_s3_bucket" "uploads" {
  bucket = "vaeloom-${var.environment}-uploads"
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"
    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
}

# ─── RDS PostgreSQL ────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name        = "vaeloom-${var.environment}-db-subnet-group"
  description = "Database subnet group"
  subnet_ids  = module.vpc.private_subnets
}

resource "aws_db_parameter_group" "postgres" {
  name        = "vaeloom-${var.environment}-pg-params"
  family      = var.db_parameter_group_family
  description = "Vaeloom PostgreSQL parameter group"

  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier = "vaeloom-${var.environment}-postgres"
  engine     = "postgres"
  engine_version = var.db_engine_version

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:05:00-sun:06:00"
  copy_tags_to_snapshot   = true
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "vaeloom-${var.environment}-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_enhanced_monitoring.arn

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = var.tags
}

# ─── ElastiCache Redis ─────────────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "redis" {
  name        = "vaeloom-${var.environment}-redis-subnet-group"
  description = "Redis subnet group"
  subnet_ids  = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "vaeloom-${var.environment}-redis"
  description                   = "Vaeloom Redis cluster"
  node_type                     = var.redis_node_type
  num_cache_clusters            = var.environment == "prod" ? 2 : 1
  port                          = 6379
  parameter_group_name          = aws_elasticache_parameter_group.redis.name
  subnet_group_name             = aws_elasticache_subnet_group.redis.name
  security_group_ids            = [aws_security_group.redis.id]
  automatic_failover_enabled    = var.environment == "prod" ? true : false
  multi_az_enabled              = var.environment == "prod" ? true : false
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  auto_minor_version_upgrade    = true
  snapshot_retention_limit      = 7
  snapshot_window               = "04:00-05:00"
  maintenance_window            = "sun:06:00-sun:07:00"

  tags = var.tags
}

resource "aws_elasticache_parameter_group" "redis" {
  name        = "vaeloom-${var.environment}-redis-params"
  family      = var.redis_parameter_group_family
  description = "Vaeloom Redis parameter group"

  parameter {
    name  = "timeout"
    value = "300"
  }
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
}

# ─── ECS Cluster ──────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "vaeloom-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = var.environment == "prod" ? 100 : 50
    base             = var.environment == "prod" ? 2 : 1
  }
}

# ─── ECR Repositories ──────────────────────────────────────────────────────
resource "aws_ecr_repository" "web" {
  name                 = "vaeloom-web"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "backend" {
  name                 = "vaeloom-backend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ─── CloudWatch Log Groups ─────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/vaeloom-${var.environment}/web"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/vaeloom-${var.environment}/backend"
  retention_in_days = 30
}

# ─── IAM Roles ────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "vaeloom-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_custom" {
  name = "vaeloom-${var.environment}-ecs-execution-custom"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
        ]
        Resource = [
          aws_ecr_repository.web.arn,
          aws_ecr_repository.backend.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          aws_cloudwatch_log_group.web.arn,
          aws_cloudwatch_log_group.backend.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/*"]
      },
    ]
  })
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "ecs_task" {
  name = "vaeloom-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "vaeloom-${var.environment}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ]
      Resource = [
        aws_s3_bucket.uploads.arn,
        "${aws_s3_bucket.uploads.arn}/*",
      ]
    }]
  })
}

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "vaeloom-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ─── ECS Task Definitions ──────────────────────────────────────────────────
resource "aws_ecs_task_definition" "web" {
  family                   = "vaeloom-${var.environment}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name              = "web"
      image             = "${aws_ecr_repository.web.repository_url}:latest"
      essential         = true
      readonlyRootFilesystem = true
      portMappings = [{
        containerPort = 3000
        protocol      = "tcp"
      }]
      environment = [
        { name = "NODE_ENV",      value = "production" },
        { name = "PORT",          value = "3000" },
        { name = "NEXT_PUBLIC_API_URL", value = "https://api.${var.domain_name}" },
        { name = "NEXT_TELEMETRY_DISABLED", value = "1" },
      ]
      secrets = [
        { name = "SENTRY_DSN", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/sentry-dsn" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }
      healthCheck = {
        command  = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval = 30
        timeout  = 10
        retries  = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "vaeloom-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      portMappings = [{
        containerPort = 8000
        protocol      = "tcp"
      }]
      secrets = [
        { name = "DATABASE__URL",  valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/database-url" },
        { name = "REDIS__URL",     valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/redis-url" },
        { name = "JWT_SECRET",     valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/jwt-secret" },
        { name = "LLM_API_KEY",    valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/llm-api-key" },
        { name = "ENCRYPTION_KEY", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/encryption-key" },
        { name = "STORAGE_ACCESS_KEY", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/storage-access-key" },
        { name = "STORAGE_SECRET_KEY", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/storage-secret-key" },
        { name = "SENTRY_DSN",     valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:vaeloom/${var.environment}/sentry-dsn" },
      ]
      environment = [
        { name = "SERVICE_NAME",        value = "vaeloom-backend" },
        { name = "SERVICE_ENVIRONMENT", value = var.environment },
        { name = "LOG_LEVEL",           value = "INFO" },
        { name = "ALLOWED_ORIGINS",     value = "https://${var.domain_name}" },
        { name = "STORAGE_ENDPOINT",    value = "https://s3.${var.aws_region}.amazonaws.com" },
        { name = "STORAGE_BUCKET",      value = aws_s3_bucket.uploads.id },
        { name = "STORAGE_REGION",      value = var.aws_region },
        { name = "RATE_LIMIT_REDIS_URL", value = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379" },
        { name = "LLM_PROVIDER",        value = "anthropic" },
        { name = "LLM_MODEL",           value = "claude-3-5-sonnet-20241022" },
        { name = "EMBEDDING_MODEL",     value = "text-embedding-3-small" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
      healthCheck = {
        command  = ["CMD-SHELL", "curl -f http://localhost:8000/api/v1/health || exit 1"]
        interval = 30
        timeout  = 10
        retries  = 3
        startPeriod = 120
      }
    }
  ])

  tags = var.tags
}

# ─── ALB ───────────────────────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "vaeloom-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "prod"
  enable_http2              = true
  enable_tls_version_and_cipher_headers = true
  idle_timeout             = 120

  tags = var.tags
}

resource "aws_lb_target_group" "web" {
  name        = "vaeloom-${var.environment}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "3000"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_target_group" "backend" {
  name        = "vaeloom-${var.environment}-api-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    port                = "8000"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    host_header {
      values = ["${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = ["api.${var.domain_name}"]
    }
  }
}

# ─── ECS Services ──────────────────────────────────────────────────────────
resource "aws_ecs_service" "web" {
  name            = "vaeloom-${var.environment}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  tags = var.tags
}

resource "aws_ecs_service" "backend" {
  name            = "vaeloom-${var.environment}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  service_connect_configuration {
    enabled  = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  tags = var.tags
}

resource "aws_service_discovery_http_namespace" "main" {
  name        = "vaeloom-${var.environment}"
  description = "Vaeloom service connect namespace"
}

# ─── CloudFront CDN ────────────────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "vaeloom-${var.environment}-s3-oac"
  description                       = "OAC for Vaeloom S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Vaeloom ${var.environment} CDN"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  aliases = ["cdn.${var.domain_name}"]

  origin {
    domain_name              = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id                = "s3-uploads"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-uploads"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  ordered_cache_behavior {
    path_pattern           = "uploads/*"
    target_origin_id       = "s3-uploads"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.cloudfront_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = var.tags
}

# ─── Route53 DNS ───────────────────────────────────────────────────────────
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "cdn.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}

# ─── WAF ───────────────────────────────────────────────────────────────────
resource "aws_wafv2_web_acl" "main" {
  name        = "vaeloom-${var.environment}-waf"
  description = "WAF for Vaeloom ALB"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-managed-common"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSCommonRules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-managed-sqli"
    priority = 3
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedSQLi"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "VaeloomWAF"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# ─── Auto Scaling ──────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "web" {
  max_capacity       = var.web_max_count
  min_capacity       = var.web_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "vaeloom-${var.environment}-web-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "web_memory" {
  name               = "vaeloom-${var.environment}-web-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.backend_max_count
  min_capacity       = var.backend_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "vaeloom-${var.environment}-backend-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "backend_memory" {
  name               = "vaeloom-${var.environment}-backend-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}
