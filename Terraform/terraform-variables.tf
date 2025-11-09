variable "aws_region" {
  description = "AWS region to deploy all resources into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment tag (e.g., dev, staging, prod)."
  type        = string
  default     = "prod"
}

variable "table_name" {
  description = "DynamoDB table name for storing company records."
  type        = string
  default     = "companies"
}

variable "location_index_name" {
  description = "Name of the GSI used for filtering by location."
  type        = string
  default     = "LocationIndex"
}

variable "ami_name_prefix" {
  description = "Prefix used when searching for the latest Packer-built AMI."
  type        = string
  default     = "companies-platform-"
}

variable "instance_type" {
  description = "EC2 instance size for hosting the app."
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Optional EC2 key pair for SSH access."
  type        = string
  default     = ""
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC that hosts the application."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet containing the EC2 instance."
  type        = string
  default     = "10.0.1.0/24"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the instance."
  type        = string
  default     = "0.0.0.0/0"
}

variable "allowed_http_cidr" {
  description = "CIDR block allowed to reach HTTP (port 80)."
  type        = string
  default     = "0.0.0.0/0"
}
