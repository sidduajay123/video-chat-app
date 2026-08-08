output "vpc_id" {
  value       = aws_vpc.video_chat_vpc.id
  description = "The ID of the created VPC"
}

output "public_subnets" {
  value       = aws_subnet.public_subnets[*].id
  description = "IDs of the public subnets"
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

output "elb_dns_name" {
  value       = try(kubernetes_service.video_chat_service.status[0].load_balancer[0].ingress[0].hostname, "pending")
  description = "DNS name of the AWS Load Balancer"
}

output "security_group_id" {
  value       = aws_security_group.eks_node_sg.id
  description = "Security Group ID for EKS nodes"
}
