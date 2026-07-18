output "eks_cluster_role_arn" { value = aws_iam_role.eks_cluster.arn }
output "eks_node_role_arn" { value = aws_iam_role.eks_nodes.arn }
output "ci_cd_deploy_role_arn" { value = aws_iam_role.ci_cd_deploy.arn }
