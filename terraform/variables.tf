variable "aws_region" {
  description = "AWS region to deploy into"
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  default     = "t3.micro"
}

variable "key_pair_name" {
  description = "Name of existing EC2 key pair for SSH access"
  default     = "ashik"
}

variable "app_name" {
  description = "Application name used for tagging"
  default     = "devops-technical-task"
}
