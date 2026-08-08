# ─── Terraform 1.5+ Declarative Imports for Existing AWS Resources ────────────

import {
  to = aws_iam_role.eks_cluster_role
  id = "EKS-Cluster-Role"
}

import {
  to = aws_iam_role.eks_node_role
  id = "EKS-Node-Group-Role"
}

import {
  to = aws_ecr_repository.app_repo
  id = "video-chat-app"
}

import {
  to = aws_elb.video_chat_elb
  id = "a3d93899534b241b981160b247d1704f"
}

import {
  to = aws_eks_cluster.video_chat_cluster
  id = "video-chat-cluster"
}
