# Packer AMI workflow

This repository now includes a simple Packer template that bakes a reusable Amazon Linux AMI with everything the Companies application needs (nginx, Python3 + venv scaffold, rsync, git, etc.). The deploy workflow can launch new instances from this image and only needs to sync the latest site + backend code.

## Files

| path | purpose |
| --- | --- |
| `packer.pkr.hcl` | Main Packer template using the `amazon-ebs` builder. |
| `packer-provision.sh` | Shell provisioning script run inside the temporary build instance; installs packages and prepares directories. |

## Prerequisites

1. Install [Packer](https://developer.hashicorp.com/packer/downloads) ≥ 1.9 locally or in CI.
2. Ensure AWS credentials are available (env vars, `~/.aws/credentials`, or an IAM role) with permissions for EC2 AMI builds (`ec2:RunInstances`,`ec2:CreateImage`,`ec2:RegisterImage`, etc.).
3. (Optional) set `AWS_PROFILE` and `AWS_REGION` if you rely on shared credentials.

## Build steps

```bash
# 1. Initialize plugins (one-time per checkout)
packer init packer.pkr.hcl

# 2. Validate template + vars
packer validate -var 'aws_region=us-east-1' packer.pkr.hcl

# 3. Build the AMI (replace vars as needed)
packer build \
  -var 'aws_region=us-east-1' \
  -var 'ami_name=companies-platform-{{timestamp}}' \
  packer.pkr.hcl
```

During the build Packer will:

1. Launch an Amazon Linux 2023 instance.
2. Upload `packer-provision.sh` and execute it to install nginx, Python, rsync, git, and pre-create `/var/www/mywebsite` plus `/home/ec2-user/companies-api/venv`.
3. Snapshot the instance into a reusable AMI tagged `Role=companies-app`.

The final AMI ID is printed at the end of `packer build`. Record it (or tag it in AWS) and update your launch templates / Auto Scaling Groups to use this image.

### GitHub Actions workflow

Prefer to build in CI? Trigger the `Build AMI with Packer` workflow (`.github/workflows/packer-build.yml`). It accepts `aws_region`, plus an optional `ami_name` override (leave blank to auto-generate `companies-platform-<run_id>`). The workflow uses the repository secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, runs `packer init`, `validate`, `build`, and prints the AMI ID in the logs.

## Customization

- Override defaults with `-var 'instance_type=t3.small'` or by creating a `packer.auto.pkrvars.hcl`.
- Adjust `source_ami_filter` if you prefer AL2, Ubuntu, etc.
- Extend `packer-provision.sh` with extra steps (install New Relic agent, copy baked assets, etc.).

## Cleanup

Packer terminates the temporary builder automatically, but it leaves the AMI + associated snapshot in your account. Delete outdated AMIs/snaps regularly to control costs.
