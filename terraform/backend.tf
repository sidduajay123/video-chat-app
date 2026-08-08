terraform {
  backend "s3" {
    bucket = "video-chat-app-tfstate-181137999309"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}
