variable "environment" {
  description = "Environment identifier (e.g., dev, staging, prod)."
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table for IAM permissions."
  type        = string
}

variable "location_index_name" {
  description = "Name of the DynamoDB GSI that stores locations."
  type        = string
}

variable "ami_name_prefix" {
  description = "Prefix used to discover the latest Packer-built AMI."
  type        = string
}

variable "ami_role_tag" {
  description = "Tag value used to filter the AMI by role."
  type        = string
  default     = "companies-app"
}

variable "instance_type" {
  description = "Instance size for the EC2 host."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs where the Auto Scaling Group can launch instances."
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID that contains the target subnet."
  type        = string
}

variable "key_name" {
  description = "Optional EC2 key pair for SSH access."
  type        = string
  default     = ""
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to reach SSH."
  type        = string
}

variable "allowed_http_cidr" {
  description = "CIDR block allowed to reach HTTP."
  type        = string
}

variable "common_tags" {
  description = "Map of common tags applied to all resources."
  type        = map(string)
}

variable "user_data" {
  description = "Rendered user data script for bootstrapping the instance."
  type        = string
}

variable "asg_desired_capacity" {
  description = "Desired number of instances for the Auto Scaling Group."
  type        = number
  default     = 1
}

variable "asg_min_size" {
  description = "Minimum number of instances for the Auto Scaling Group."
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum number of instances for the Auto Scaling Group."
  type        = number
  default     = 1
}
