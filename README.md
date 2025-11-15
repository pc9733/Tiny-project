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
| `codedeploy/` | `appspec.yml` plus lifecycle scripts used by AWS CodeDeploy to fan out releases to every EC2 instance. |
| `.github/workflows/` | `ci.yml` runs unit/infrastructure tests on push/PR; `deploy.yml` packages and ships releases via CodeDeploy. |
| `VERSION` | Single source of truth for the app version (semantic versioning). |

## Versioning

- The repository root contains a `VERSION` file (Semantic Versioning). Bump it as part of each release (e.g., `1.1.0`).
- The Flask API exposes `/version` and also embeds `version` in `/health`; both read from the file (or the `APP_VERSION` env var if you override it during deployments).
- Deployment pipelines can `cat VERSION` to tag artifacts or annotate GitHub releases. Example:
  ```bash
  export APP_VERSION="$(cat VERSION)"
  ```
- To override at runtime (e.g., blue/green tests), set `APP_VERSION` in the systemd unit or environment before restarting `companies-api`.
- GitHub Actions’ deploy workflow packages the repository into `companies-app-<version>.zip`, stores it as a build artifact, uploads it to S3, and lets CodeDeploy install that specific version across the Auto Scaling Group.

## CI/CD workflows

- `CI` (`.github/workflows/ci.yml`): runs on every push/PR. It compiles the Flask backend, runs Terraform fmt/validate, and performs `packer validate` to catch infrastructure regressions early.
- `Deploy via CodeDeploy` (`.github/workflows/deploy.yml`): manual `workflow_dispatch`. The pipeline checks out the requested branch, runs backend sanity tests, builds the release zip (containing `web/`, `backend/`, `scripts/`, `VERSION`, and `appspec.yml`), uploads it to S3, and triggers an AWS CodeDeploy deployment targeting the Auto Scaling Group. CodeDeploy then executes the lifecycle scripts from `codedeploy/scripts/` on every instance (stop services, copy files, install deps, restart, and `curl /health`).

### Required secrets for deploy workflow

| Secret | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Credentials used by GitHub Actions for S3 + CodeDeploy API calls. |
| `CODEDEPLOY_BUCKET` | S3 bucket where release zips are uploaded (e.g., `companies-artifacts`). |
| `CODEDEPLOY_APPLICATION` | Name of the CodeDeploy application (must target the EC2/On-Prem platform). |
| `CODEDEPLOY_DEPLOYMENT_GROUP` | CodeDeploy deployment group that references the Auto Scaling Group provisioned by Terraform. |

### Release artifact layout

```
companies-app-<version>.zip
├── appspec.yml
├── backend/            # Flask API, systemd service, requirements.txt
├── scripts/            # CodeDeploy lifecycle hooks
├── VERSION
└── web/                # index.html, location.html, assets/
```

Each hook script is idempotent—the `BeforeInstall` script stops services and cleans directories, `AfterInstall` installs Python deps, `ApplicationStart` restarts nginx + Gunicorn, and `ValidateService` pings `/health`.

## How it works

1. **Infrastructure**: Terraform provisions the DynamoDB table, VPC/subnet, security group, IAM role, and an EC2 instance launched via a template that injects environment variables plus New Relic license data (user data leverages SSM parameter `/observability/newrelic/license_key`). The EC2 role has DynamoDB CRUD permissions and permission to read that SSM parameter.
2. **Base image**: Packer builds an Amazon Linux 2023 AMI with nginx, Python3, rsync, git, the AWS CodeDeploy agent, the New Relic agent (disabled), and pre-created directories for `/var/www/mywebsite` plus `/home/ec2-user/companies-api`.
3. **Deploy pipeline**: GitHub Actions builds a versioned release zip, uploads it to S3, and creates a CodeDeploy deployment that targets the Auto Scaling Group. The CodeDeploy hooks run on every instance (stop services, copy files, install deps, restart, verify `/health`), so scaling events automatically receive the same build.
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

- `aws-actions/configure-aws-credentials` expects `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.
- The deploy workflow also needs `CODEDEPLOY_BUCKET`, `CODEDEPLOY_APPLICATION`, and `CODEDEPLOY_DEPLOYMENT_GROUP`.
- Manual `workflow_dispatch` input `target_branch` controls which branch is packaged (defaults to `main`).

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
