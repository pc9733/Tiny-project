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

resource "aws_iam_role" "companies" {
  name               = "companies-app-role-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "dynamo_access" {
  statement {
    sid    = "DynamoAccess"
    effect = "Allow"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
      "dynamodb:Query"
    ]

    resources = [
      aws_dynamodb_table.companies.arn,
      "${aws_dynamodb_table.companies.arn}/index/${var.location_index_name}"
    ]
  }
}

resource "aws_iam_role_policy" "companies" {
  name   = "companies-dynamo-access"
  role   = aws_iam_role.companies.id
  policy = data.aws_iam_policy_document.dynamo_access.json
}

resource "aws_iam_instance_profile" "companies" {
  name = "companies-instance-profile-${var.environment}"
  role = aws_iam_role.companies.name
}

resource "aws_security_group" "companies" {
  name        = "companies-sg-${var.environment}"
  description = "Allow SSH and HTTP to companies app"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.allowed_http_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "companies-sg"
  })
}

resource "aws_instance" "companies" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = var.subnet_id

  vpc_security_group_ids = [aws_security_group.companies.id]
  associate_public_ip_address = true

  iam_instance_profile = aws_iam_instance_profile.companies.name
  key_name             = var.key_name != "" ? var.key_name : null

  user_data = templatefile("${path.module}/terraform-user-data.sh.tpl", {
    table_name = var.table_name
    aws_region = var.aws_region
  })

  tags = merge(local.common_tags, {
    Name = "companies-app"
  })

  depends_on = [aws_dynamodb_table.companies]
}
