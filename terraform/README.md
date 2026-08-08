# Terraform Infrastructure for ConnectNow Video Chat Application

This Terraform configuration provisions the entire AWS infrastructure for **ConnectNow** (`omeglefun.work.gd`).

---

## 🏗️ Architecture Provisioned

- **VPC & Subnets**: Multi-AZ VPC with 3 Public Subnets, Internet Gateway, and Route Tables.
- **Security Groups**: Configured NodePort access (`30000-32767`, `3000`, `80`, `443`).
- **IAM Roles**: EKS Cluster Policy and Worker Node Policies.
- **Amazon ECR**: Container registry `video-chat-app` for storing Docker builds.
- **Amazon EKS**: Kubernetes Cluster `video-chat-cluster` (v1.36).
- **EKS Node Group**: `video-chat-nodes` using `t3.small` nodes (1 unified replica for instant matchmaking).
- **AWS Classic Load Balancer (ELB)**: SSL/HTTPS termination with ACM Certificate (`omeglefun.work.gd`), HTTP redirection, 3600s idle connection timeout.

---

## 🚀 How to Use

### 1. Prerequisites
- Installed [Terraform](https://www.terraform.io/downloads) (>= 1.3.0)
- Installed [AWS CLI](https://aws.amazon.com/cli/) configured with valid AWS credentials (`aws configure`)

### 2. Initialize Terraform
```bash
cd terraform
terraform init
```

### 3. Review Plan
```bash
terraform plan
```

### 4. Apply Infrastructure
```bash
terraform apply
```

### 5. Configure `kubectl` Access
```bash
aws eks update-kubeconfig --name video-chat-cluster --region us-east-1
```

### 6. Deploy Kubernetes Manifests
```bash
kubectl apply -f ../k8s/deployment.yaml
```

---

## 📄 Output Values

After `terraform apply`, Terraform outputs:
- `vpc_id`
- `public_subnets`
- `eks_cluster_name`
- `eks_cluster_endpoint`
- `ecr_repository_url`
- `elb_dns_name`
