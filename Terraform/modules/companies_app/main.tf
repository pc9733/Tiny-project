locals {
  common_name = "companies-app"
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
      var.dynamodb_table_arn,
      "${var.dynamodb_table_arn}/index/${var.location_index_name}"
    ]
  }
}

data "aws_iam_policy_document" "nr_ssm" {
  statement {
    sid    = "ReadNewRelicLicense"
    effect = "Allow"

    actions = [
      "ssm:GetParameter",
    ]

    resources = [
      "arn:aws:ssm:us-east-1:561067235272:parameter/observability/newrelic/license_key",
    ]
  }
}

data "aws_ami" "packer" {
  owners      = ["self"]
  most_recent = true

  filter {
    name   = "name"
    values = ["${var.ami_name_prefix}*"]
  }

  filter {
    name   = "tag:Role"
    values = [var.ami_role_tag]
  }
}

resource "aws_iam_role" "this" {
  name               = "${local.common_name}-role-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
  tags               = var.common_tags
}

resource "aws_iam_role_policy" "this" {
  name   = "${local.common_name}-dynamo-access"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.dynamo_access.json
}

resource "aws_iam_role_policy" "nr_ssm" {
  name   = "${local.common_name}-nr-ssm"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.nr_ssm.json
}

resource "aws_iam_instance_profile" "this" {
  name = "${local.common_name}-instance-profile-${var.environment}"
  role = aws_iam_role.this.name
}

resource "aws_security_group" "this" {
  name        = "${local.common_name}-sg-${var.environment}"
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

  tags = merge(var.common_tags, {
    Name = "companies-sg"
  })
}

resource "aws_instance" "this" {
  ami                         = data.aws_ami.packer.id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.this.id]
  associate_public_ip_address = true

  iam_instance_profile = aws_iam_instance_profile.this.name
  key_name             = var.key_name != "" ? var.key_name : null
  user_data            = var.user_data

  tags = merge(var.common_tags, {
    Name = local.common_name
  })

  depends_on = [aws_iam_role_policy.this]
}
