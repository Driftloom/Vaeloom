locals {
  repositories = toset(concat(var.app_repositories, var.service_repositories))
}

resource "aws_ecr_repository" "main" {
  for_each = local.repositories
  name                 = "vaeloom/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.environment != "prod"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "vaeloom/${each.key}" }
}

resource "aws_ecr_lifecycle_policy" "main" {
  for_each   = local.repositories
  repository = aws_ecr_repository.main[each.key].name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus     = "any"
        countType     = "imageCountMoreThan"
        countNumber   = 30
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_repository_policy" "main" {
  for_each   = local.repositories
  repository = aws_ecr_repository.main[each.key].name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "EKS pull access"
      Effect = "Allow"
      Principal = {
        AWS = var.eks_node_role_arn
      }
      Action = [
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
      ]
    }]
  })
}
