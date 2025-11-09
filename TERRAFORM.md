# Terraform stack

This configuration provisions the minimum infrastructure for the Companies app using AWS:

- DynamoDB table (`companies` by default) plus `LocationIndex` GSI.
- IAM role/instance profile with permissions to the table.
- Security group that opens SSH/HTTP.
- EC2 instance launched from your baked AMI (Packer workflow) with optional user data for env vars.

## Files

| file | purpose |
| --- | --- |
| `terraform-provider.tf` | Terraform + AWS provider requirements. |
| `terraform-variables.tf` | Input variables (region, AMI ID, networking, etc.). |
| `terraform-main.tf` | Core resources (DynamoDB, IAM, SG, EC2). |
| `terraform-user-data.sh.tpl` | Template used for EC2 `user_data` (injects env vars). |
| `terraform-outputs.tf` | Key outputs. |

## Usage

1. Install Terraform ≥ 1.6.
2. Supply the required variables, typically via a `terraform.tfvars` file:

   ```hcl
   aws_region     = "us-east-1"
   ami_id         = "ami-0123456789abcdef0"
   subnet_id      = "subnet-0abc123456789def0"
   vpc_id         = "vpc-0123abcd4567ef890"
   key_name       = "companies-admin"
   allowed_ssh_cidr  = "203.0.113.0/24"
   allowed_http_cidr = "0.0.0.0/0"
   environment    = "prod"
   ```

3. Initialize + review plan:

   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

4. After apply, note the outputs for the instance IP and table name. Point the GitHub deploy workflow at the new instance (or update an Auto Scaling Group/target group).

## Notes

- The configuration expects you to provide the AMI ID (build via the included Packer workflow). This keeps Terraform focused on infra while GitHub Actions handles deployments.
- Networking is intentionally simple: it reuses an existing VPC/subnet. Extend it with load balancers, HTTPS listeners, etc., as needed.
- The EC2 instance profile only has DynamoDB permissions. Add other policies (S3, CloudWatch, etc.) in `data "aws_iam_policy_document" "dynamo_access"` if the app grows.
