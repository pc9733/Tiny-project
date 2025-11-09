packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ami_name" {
  type    = string
  default = "companies-platform-{{timestamp}}"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "ssh_username" {
  type    = string
  default = "ec2-user"
}

source "amazon-ebs" "companies" {
  region                  = var.aws_region
  instance_type           = var.instance_type
  ssh_username            = var.ssh_username
  ami_name                = var.ami_name
  ami_description         = "Base AMI for Companies app (nginx + python + gunicorn prerequisites)"
  associate_public_ip_address = true

  source_ami_filter {
    filters = {
      virtualization-type = "hvm"
      name                = "al2023-ami-*-kernel-6.1-x86_64"
      root-device-type    = "ebs"
    }
    owners      = ["137112412989"]
    most_recent = true
  }

  launch_block_device_mappings {
    device_name           = "/dev/xvda"
    volume_size           = 16
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "companies-platform"
    Role = "companies-app"
  }
}

build {
  sources = ["source.amazon-ebs.companies"]

  provisioner "file" {
    source      = "packer-provision.sh"
    destination = "/tmp/packer-provision.sh"
  }

  provisioner "shell" {
    inline = [
      "chmod +x /tmp/packer-provision.sh",
      "sudo /tmp/packer-provision.sh"
    ]
  }
}
