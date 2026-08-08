variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS Region for all infrastructure resources"
}

variable "cluster_name" {
  type        = string
  default     = "video-chat-cluster"
  description = "Name of the EKS Cluster"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Deployment environment name"
}

variable "domain_name" {
  type        = string
  default     = "omeglefun.work.gd"
  description = "Primary domain for the video chat application"
}

variable "node_instance_type" {
  type        = string
  default     = "t3.small"
  description = "EC2 instance type for EKS worker nodes"
}

variable "node_desired_size" {
  type        = number
  default     = 1
  description = "Desired number of EKS worker nodes"
}

variable "node_min_size" {
  type        = number
  default     = 1
  description = "Minimum number of EKS worker nodes"
}

variable "node_max_size" {
  type        = number
  default     = 2
  description = "Maximum number of EKS worker nodes"
}

variable "acm_certificate_arn" {
  type        = string
  default     = "arn:aws:acm:us-east-1:181137999309:certificate/1fcecdcb-fd6b-4876-b48f-0ba535310324"
  description = "ACM SSL Certificate ARN for domain omeglefun.work.gd"
}
