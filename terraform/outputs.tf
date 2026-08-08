output "vpc_id" {
  value       = data.aws_vpc.default.id
  description = "The ID of the VPC"
}

output "public_subnets" {
  value       = data.aws_subnets.default.ids
  description = "IDs of the subnets"
}

output "eks_cluster_name" {
  value       = aws_eks_cluster.video_chat_cluster.name
  description = "Name of the EKS Cluster"
}

output "eks_cluster_endpoint" {
  value       = aws_eks_cluster.video_chat_cluster.endpoint
  description = "Kubernetes API Server Endpoint"
}

output "ecr_repository_url" {
  value       = data.aws_ecr_repository.app_repo.repository_url
  description = "URL of the Amazon ECR Docker repository"
}



output "security_group_id" {
  value       = aws_security_group.eks_node_sg.id
  description = "Security Group ID for EKS nodes"
}
