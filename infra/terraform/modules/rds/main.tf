resource "aws_db_subnet_group" "main" {
  name       = "vaeloom-${var.environment}-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "vaeloom-${var.environment}-db-subnet-group" }
}

resource "aws_security_group" "rds" {
  name        = "vaeloom-${var.environment}-rds-sg"
  vpc_id      = var.vpc_id
  description = "RDS security group"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
  }
}

resource "aws_db_instance" "main" {
  identifier     = "vaeloom-${var.environment}"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.db_instance_class

  db_name  = "vaeloom"
  username = "vaeloom"
  password = random_password.db_password.result

  allocated_storage     = var.allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  backup_retention_period = var.environment == "prod" ? 30 : 7
  backup_window         = "03:00-04:00"
  maintenance_window    = "sun:04:00-sun:05:00"

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment == "prod" ? false : true

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = { Name = "vaeloom-${var.environment}-postgres" }
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "aws_ssm_parameter" "db_url" {
  name  = "/vaeloom/${var.environment}/database/url"
  type  = "SecureString"
  value = "postgresql://vaeloom:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/vaeloom"
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/vaeloom/${var.environment}/database/password"
  type  = "SecureString"
  value = random_password.db_password.result
}
