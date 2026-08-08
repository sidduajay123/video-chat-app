# Optional: Remote S3 backend for shared team state
# Uncomment and update bucket name after creating S3 bucket in AWS

# terraform {
#   backend "s3" {
#     bucket         = "video-chat-app-tfstate"
#     key            = "production/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "video-chat-app-tflocks"
#     encrypt        = true
#   }
# }
