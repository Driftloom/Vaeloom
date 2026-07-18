output "cluster_id" { value = aws_eks_cluster.main.id }
output "cluster_name" { value = aws_eks_cluster.main.name }
output "cluster_arn" { value = aws_eks_cluster.main.arn }
output "cluster_endpoint" { value = aws_eks_cluster.main.endpoint }
output "cluster_certificate_authority_data" { value = aws_eks_cluster.main.certificate_authority[0].data }
output "cluster_security_group_id" { value = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id }
output "node_group_role_arn" { value = aws_iam_role.eks_nodes.arn }
