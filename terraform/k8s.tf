# ─── Kubernetes Provider Setup ────────────────────────────────────────────────
provider "kubernetes" {
  host                   = aws_eks_cluster.video_chat_cluster.endpoint
  cluster_ca_certificate = try(base64decode(aws_eks_cluster.video_chat_cluster.certificate_authority[0].data), "")
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    args        = ["eks", "get-token", "--cluster-name", aws_eks_cluster.video_chat_cluster.name]
    command     = "aws"
  }
}

# ─── Namespace ────────────────────────────────────────────────────────────────
resource "kubernetes_namespace" "video_chat" {
  metadata {
    name = "video-chat"
    labels = {
      app = "video-chat-app"
    }
  }

  depends_on = [
    aws_eks_cluster.video_chat_cluster,
    aws_eks_node_group.video_chat_nodes
  ]
}

# ─── ConfigMap ────────────────────────────────────────────────────────────────
resource "kubernetes_config_map" "video_chat_config" {
  metadata {
    name      = "video-chat-config"
    namespace = kubernetes_namespace.video_chat.metadata[0].name
  }

  data = {
    NODE_ENV        = "production"
    PORT            = "3000"
    ALLOWED_ORIGINS = "*"
  }
}

# ─── Deployment ───────────────────────────────────────────────────────────────
resource "kubernetes_deployment" "video_chat_app" {
  metadata {
    name      = "video-chat-app"
    namespace = kubernetes_namespace.video_chat.metadata[0].name
    labels = {
      app     = "video-chat-app"
      version = "1.0.0"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "video-chat-app"
      }
    }

    template {
      metadata {
        labels = {
          app = "video-chat-app"
        }
      }

      spec {
        container {
          name  = "video-chat-app"
          image = "${data.aws_ecr_repository.app_repo.repository_url}:latest"

          port {
            container_port = 3000
            name           = "http"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.video_chat_config.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 15
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [
    aws_eks_node_group.video_chat_nodes
  ]
}

# ─── Service (LoadBalancer with Sticky Sessions) ──────────────────────────────
resource "kubernetes_service" "video_chat_service" {
  metadata {
    name      = "video-chat-service"
    namespace = kubernetes_namespace.video_chat.metadata[0].name
    labels = {
      app = "video-chat-app"
    }
    annotations = {
      "service.beta.kubernetes.io/aws-load-balancer-ssl-cert"               = var.acm_certificate_arn
      "service.beta.kubernetes.io/aws-load-balancer-ssl-ports"              = "443"
      "service.beta.kubernetes.io/aws-load-balancer-backend-protocol"     = "http"
      "service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout" = "3600"
    }
  }

  spec {
    session_affinity = "ClientIP"
    session_affinity_config {
      client_ip {
        timeout_seconds = 10800
      }
    }

    selector = {
      app = "video-chat-app"
    }

    port {
      name        = "http"
      protocol    = "TCP"
      port        = 80
      target_port = 3000
    }

    port {
      name        = "https"
      protocol    = "TCP"
      port        = 443
      target_port = 3000
    }

    type = "LoadBalancer"
  }

  depends_on = [
    kubernetes_deployment.video_chat_app
  ]
}
