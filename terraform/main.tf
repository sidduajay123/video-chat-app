terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── Data Sources ──────────────────────────────────────────────────────────────
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ─── Security Groups ──────────────────────────────────────────────────────────
data "aws_security_group" "eks_node_sg" {
  name   = "video-chat-node-sg"
  vpc_id = data.aws_vpc.default.id
}

# ─── IAM Roles for EKS ─────────────────────────────────────────────────────────
data "aws_iam_role" "eks_cluster_role" {
  name = "EKS-Cluster-Role"
}

data "aws_iam_role" "eks_node_role" {
  name = "EKS-Node-Group-Role"
}

# ─── ECR Repository ────────────────────────────────────────────────────────────
data "aws_ecr_repository" "app_repo" {
  name = "video-chat-app"
}

# ─── EKS Cluster ───────────────────────────────────────────────────────────────
resource "aws_eks_cluster" "video_chat_cluster" {
  name     = var.cluster_name
  role_arn = data.aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids              = data.aws_subnets.default.ids
    security_group_ids      = [data.aws_security_group.eks_node_sg.id]
    endpoint_public_access  = true
    endpoint_private_access = true
  }

  tags = {
    Name        = var.cluster_name
    Environment = var.environment
  }
}

# ─── EKS Node Group ───────────────────────────────────────────────────────────
resource "aws_eks_node_group" "video_chat_nodes" {
  cluster_name    = aws_eks_cluster.video_chat_cluster.name
  node_group_name = "video-chat-nodes"
  node_role_arn   = data.aws_iam_role.eks_node_role.arn
  subnet_ids      = data.aws_subnets.default.ids
  instance_types  = [var.node_instance_type]
  capacity_type   = "ON_DEMAND"
  ami_type        = "AL2023_x86_64_STANDARD"
  disk_size       = 20

  scaling_config {
    desired_size = var.node_desired_size
    min_size     = var.node_min_size
    max_size     = var.node_max_size
  }

  update_config {
    max_unavailable = 1
  }

  tags = {
    Name        = "video-chat-nodes"
    Environment = var.environment
  }
}


