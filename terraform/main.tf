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
data "aws_availability_zones" "available" {
  state = "available"
}

# ─── VPC & Networking ─────────────────────────────────────────────────────────
resource "aws_vpc" "video_chat_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name                                        = "video-chat-vpc"
    Environment                                 = var.environment
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.video_chat_vpc.id

  tags = {
    Name        = "video-chat-igw"
    Environment = var.environment
  }
}

resource "aws_subnet" "public_subnets" {
  count                   = 3
  vpc_id                  = aws_vpc.video_chat_vpc.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                        = "video-chat-public-subnet-${count.index + 1}"
    Environment                                 = var.environment
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                    = "1"
  }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.video_chat_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name        = "video-chat-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public_subnets)
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

# ─── Security Groups ──────────────────────────────────────────────────────────
resource "aws_security_group" "eks_node_sg" {
  name        = "video-chat-node-sg"
  description = "Security group for EKS worker nodes and load balancer access"
  vpc_id      = aws_vpc.video_chat_vpc.id

  # Allow NodePort traffic (Kubernetes services & load balancers)
  ingress {
    description = "NodePort range"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow direct app port
  ingress {
    description = "Application Port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP & HTTPS
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

  # Allow all internal node-to-node communication
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
    subnet_ids              = aws_subnet.public_subnets[*].id
    security_group_ids      = [aws_security_group.eks_node_sg.id]
    endpoint_public_access  = true
    endpoint_private_access = true
  }

  compute_config {
    enabled       = true
    node_pools    = ["general-purpose", "system"]
    node_role_arn = aws_iam_role.eks_node_role.arn
  }

  storage_config {
    block_storage {
      enabled = true
    }
  }

  kubernetes_network_config {
    elastic_load_balancing {
      enabled = true
    }
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
  subnet_ids      = aws_subnet.public_subnets[*].id
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


