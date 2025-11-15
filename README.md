# Companies App Platform

This repository contains everything required to run the Companies CRUD web app on AWS:

- Static front-end (HTML/JS/CSS) that talks to a Flask API.
- Flask backend that persists companies in DynamoDB.
- Terraform stack (VPC, subnet, security group, DynamoDB, EC2 + IAM).
- Packer template to bake the reusable Amazon Linux AMI.
- GitHub Actions workflows to deploy the app and build AMIs.

## Repository tour

| Path | Description |
| --- | --- |
| `index.html`, `location.html`, `assets/` | Front-end views and scripts. `assets/app.js` drives CRUD + filtering, `assets/style.js` injects styling. |
| `backend/` | Flask API (`app.py`), systemd unit, and Python requirements. Uses boto3 to access DynamoDB. |
| `Terraform/` | Root Terraform stack plus `modules/companies_app` (IAM role, launch template, EC2 host). |
| `packer/` | `packer.pkr.hcl` template and `packer-provision.sh` script to bake the base AMI. |
| `.github/workflows/` | `deploy.yml` syncs the site/backend to EC2; `packer-build.yml` (see repo) bakes AMIs in CI. |
| `VERSION` | Single source of truth for the app version (semantic versioning). |

## Versioning

- The repository root contains a `VERSION` file (Semantic Versioning). Bump it as part of each release (e.g., `1.1.0`).
- The Flask API exposes `/version` and also embeds `version` in `/health`; both read from the file (or the `APP_VERSION` env var if you override it during deployments).
- Deployment pipelines can `cat VERSION` to tag artifacts or annotate GitHub releases. Example:
  ```bash
  export APP_VERSION="$(cat VERSION)"
  ```
- To override at runtime (e.g., blue/green tests), set `APP_VERSION` in the systemd unit or environment before restarting `companies-api`.
- GitHub Actions’ deploy workflow now packages the entire repository into `dist/companies-app-<version>.tar.gz` before uploading to the EC2 host, giving you a versioned artifact that can be archived or reused for future automation (e.g., storing in S3 before CodeDeploy).

## How it works

1. **Infrastructure**: Terraform provisions the DynamoDB table, VPC/subnet, security group, IAM role, and an EC2 instance launched via a template that injects environment variables plus New Relic license data (user data leverages SSM parameter `/observability/newrelic/license_key`). The EC2 role has DynamoDB CRUD permissions and permission to read that SSM parameter.
2. **Base image**: Packer builds an Amazon Linux 2023 AMI with nginx, Python3, rsync, git, New Relic agent (disabled), and pre-created directories for `/var/www/mywebsite` and `/home/ec2-user/companies-api`.
3. **Deploy pipeline**: The GitHub deploy workflow (`.github/workflows/deploy.yml`) runs on demand (`workflow_dispatch`). Steps:
   - Checkout repo.
   - Configure SSH using repo secrets `EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER`.
   - Rsync the entire repo to `/tmp/mywebsite/` on the EC2 host.
   - Install/refresh nginx config (proxying `/api/` to 127.0.0.1:8000) and reload nginx.
   - Sync `backend/` to `~/companies-api`, install Python deps in the venv, copy the systemd service, and restart `companies-api`.
4. **Runtime**: nginx serves the static front-end and proxies API calls to Gunicorn (running the Flask app). The Flask API talks to DynamoDB using credentials inherited from the instance role.

## Local development

```bash
# Front-end: open index.html directly or via any static server.

# Backend: run Flask locally (requires AWS creds pointing at a dev table).
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export TABLE_NAME=companies-dev AWS_REGION=us-east-1
flask --app app run --port 8000
```

Update `assets/app.js` `BASE` constant if you host the API elsewhere (e.g., `const BASE = "http://localhost:8000";`).

## Terraform workflow

```bash
cd Terraform
terraform init
terraform fmt
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Required variables include AWS region, AMI naming prefix, networking (existing VPC/subnet or defaults), key pair name, and CIDR blocks. Outputs provide the instance ID and public IP.

## Packer workflow

```bash
cd packer
packer init packer.pkr.hcl
packer validate -var 'aws_region=us-east-1' packer.pkr.hcl
packer build -var 'aws_region=us-east-1' packer.pkr.hcl
```

Provide AWS credentials with AMI build permissions. The resulting AMI should match the `ami_name_prefix`/`ami_role_tag` Terraform expects.

## GitHub secrets / inputs

| Secret / Input | Purpose |
| --- | --- |
| `EC2_SSH_KEY` | Base64-encoded or literal private key used for rsync/ssh during deploy. |
| `EC2_HOST` | Public hostname/IP of the EC2 instance. |
| `EC2_USER` | SSH username (default `ec2-user`). |
| Workflow input `target_branch` | Choose branch to deploy (`main` or `develop`). |

Ensure AWS creds for Packer workflow (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) exist if you run `packer-build.yml`.

## Smoke tests after deploy

1. `curl http://<host>/health` → `{"ok": true}` confirms nginx → Gunicorn path.
2. Use the UI to create/update/delete a company; verify entries appear in DynamoDB (or use API directly).
3. Visit `location.html?loc=gurgaon` to validate filtered views.
4. Restart services (`sudo systemctl restart companies-api && sudo systemctl reload nginx`) to confirm systemd units behave.

## Operational notes

- Terraform state files (`Terraform/terraform.tfstate*`) are currently committed—migrate them to remote storage (e.g., S3 + DynamoDB) for shared use and rotate any leaked credentials.
- The launch template’s user data expects the `/observability/newrelic/license_key` SSM parameter to exist (StringParameter with KMS encryption). Without it, the New Relic agent start will fail; create the parameter before applying Terraform.
- Front-end uses the same JavaScript bundle for both pages; keep `location.html` stylesheet references in sync with `index.html` updates.

Questions or improvements? Open an issue or update the relevant section and submit a PR.
