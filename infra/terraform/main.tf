module "vpc" {
  source              = "./modules/vpc"
  environment         = var.environment
  cidr_block          = var.vpc_cidr
  availability_zones  = var.availability_zones
}

module "kms" {
  source      = "./modules/kms"
  environment = var.environment
}

module "s3" {
  source      = "./modules/s3"
  environment = var.environment
  bucket_name = "files"
  kms_key_id  = module.kms.key_id
}

module "iam" {
  source          = "./modules/iam"
  environment     = var.environment
  eks_cluster_arn = module.eks.cluster_arn
  ecr_repository_arns = values(module.ecr.repository_urls)
  s3_bucket_arn   = module.s3.bucket_arn
  kms_key_arn     = module.kms.key_arn
}

module "eks" {
  source                  = "./modules/eks"
  environment             = var.environment
  private_subnet_ids      = module.vpc.private_subnet_ids
  cluster_version         = var.cluster_version
  node_instance_types     = var.node_instance_types
  node_group_min_size     = var.node_group_min_size
  node_group_max_size     = var.node_group_max_size
  node_group_desired_size = var.node_group_desired_size
}

module "rds" {
  source                  = "./modules/rds"
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  eks_security_group_id   = module.eks.cluster_security_group_id
  db_instance_class       = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
}

module "elasticache" {
  source                  = "./modules/elasticache"
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  eks_security_group_id   = module.eks.cluster_security_group_id
}

module "ecr" {
  source              = "./modules/ecr"
  environment         = var.environment
  app_repositories    = var.app_repositories
  service_repositories = var.service_repositories
  eks_node_role_arn   = module.iam.eks_node_role_arn
}

module "waf" {
  source       = "./modules/waf"
  environment  = var.environment
  scope        = "CLOUDFRONT"
  log_group_arn = module.monitoring.alert_topic_arn
}

module "cloudfront" {
  source               = "./modules/cloudfront"
  environment          = var.environment
  s3_bucket_id         = module.s3.bucket_id
  s3_bucket_arn        = module.s3.bucket_arn
  s3_bucket_domain     = module.s3.bucket_id
  domain_aliases       = var.domain_aliases
  acm_certificate_arn  = var.acm_certificate_arn
  waf_acl_arn          = module.waf.web_acl_arn
}

module "route53" {
  source                   = "./modules/route53"
  environment              = var.environment
  domain_name              = var.domain_name
  cloudfront_domain_name   = module.cloudfront.domain_name
  cloudfront_hosted_zone_id = module.cloudfront.distribution_id
}

module "monitoring" {
  source         = "./modules/monitoring"
  environment    = var.environment
  aws_region     = var.aws_region
  app_services   = var.app_repositories
  micro_services = var.service_repositories
  kms_key_id     = module.kms.key_id
  alert_emails   = var.alert_emails
}
