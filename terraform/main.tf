terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

  filter {
    name   = "availability-zone"
    values = ["us-east-1a", "us-east-1b", "us-east-1c", "us-east-1d", "us-east-1f"]
  }
}

# ─── Security Groups ──────────────────────────────────────────────────────────
resource "aws_security_group" "eks_node_sg" {
  name_prefix = "video-chat-node-sg-"
  description = "Security group for EKS worker nodes and load balancer access"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "NodePort range"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Application Port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Node-to-node internal communication"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name                                        = "video-chat-node-sg"
    Environment                                 = var.environment
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  }
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
    security_group_ids      = [aws_security_group.eks_node_sg.id]
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


