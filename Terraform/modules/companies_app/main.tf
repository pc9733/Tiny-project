locals {
  common_name = "companies-app"

  newrelic_user_data = <<-EOT
    #!/bin/bash
    set -ex

    PKG_MGR="yum"
    if command -v dnf >/dev/null 2>&1; then
      PKG_MGR="dnf"
    fi

    if ! command -v jq >/dev/null 2>&1; then
      sudo "$PKG_MGR" install -y jq
    fi

    REGION="$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)"

    NR_LICENSE=$(aws ssm get-parameter \
      --with-decryption \
      --region "$REGION" \
      --name "/observability/newrelic/license_key" \
      --query "Parameter.Value" \
      --output text)

    sudo tee /etc/newrelic-infra.yml >/dev/null <<EOF
    license_key: $NR_LICENSE
    display_name: $(hostname)
    EOF

    sudo systemctl enable newrelic-infra
    sudo systemctl restart newrelic-infra
  EOT

  combined_user_data_parts = compact([
    trimspace(var.user_data),
    trimspace(local.newrelic_user_data),
  ])

  final_user_data = length(local.combined_user_data_parts) > 0 ? join("\n\n", local.combined_user_data_parts) : ""
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
      "arn:aws:ssm:*:*:parameter/observability/newrelic/license_key",
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

resource "aws_launch_template" "this" {
  name_prefix   = "${local.common_name}-lt-"
  image_id      = data.aws_ami.packer.id
  instance_type = var.instance_type
  key_name      = var.key_name != "" ? var.key_name : null

  iam_instance_profile {
    name = aws_iam_instance_profile.this.name
  }

  vpc_security_group_ids = [aws_security_group.this.id]

  user_data = base64encode(local.final_user_data)

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_instance" "this" {
  subnet_id = var.subnet_id

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  tags = merge(var.common_tags, {
    Name = local.common_name
  })

  depends_on = [
    aws_iam_role_policy.this,
    aws_iam_role_policy.nr_ssm,
  ]
}
