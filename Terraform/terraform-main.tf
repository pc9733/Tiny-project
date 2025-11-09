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

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.common_tags.Project}-${var.environment}-vpc"
  })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.common_tags.Project}-${var.environment}-igw"
  })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = merge(local.common_tags, {
    Name = "${local.common_tags.Project}-${var.environment}-public-subnet"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.common_tags.Project}-${var.environment}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

module "companies_app" {
  source = "./modules/companies_app"

  environment          = var.environment
  dynamodb_table_arn   = aws_dynamodb_table.companies.arn
  location_index_name  = var.location_index_name
  ami_name_prefix      = var.ami_name_prefix
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.public.id
  vpc_id               = aws_vpc.main.id
  key_name             = var.key_name
  allowed_ssh_cidr     = var.allowed_ssh_cidr
  allowed_http_cidr    = var.allowed_http_cidr
  common_tags          = local.common_tags
  user_data            = templatefile("${path.module}/terraform-user-data.sh.tpl", {
    table_name = aws_dynamodb_table.companies.name
    aws_region = var.aws_region
  })
}
