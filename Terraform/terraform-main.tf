locals {
  common_tags = {
    Project     = "companies-app"
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "companies" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "location"
    type = "S"
  }

  global_secondary_index {
    name            = var.location_index_name
    hash_key        = "location"
    projection_type = "ALL"
  }

  tags = merge(local.common_tags, {
    Name = var.table_name
  })
}

module "companies_app" {
  source = "./modules/companies_app"

  environment          = var.environment
  dynamodb_table_arn   = aws_dynamodb_table.companies.arn
  location_index_name  = var.location_index_name
  ami_name_prefix      = var.ami_name_prefix
  instance_type        = var.instance_type
  subnet_id            = var.subnet_id
  vpc_id               = var.vpc_id
  key_name             = var.key_name
  allowed_ssh_cidr     = var.allowed_ssh_cidr
  allowed_http_cidr    = var.allowed_http_cidr
  common_tags          = local.common_tags
  user_data            = templatefile("${path.module}/terraform-user-data.sh.tpl", {
    table_name = aws_dynamodb_table.companies.name
    aws_region = var.aws_region
  })
}
