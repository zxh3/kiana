# Kiana infrastructure

This uv application manages Kiana's AWS infrastructure with Pulumi. It creates
an S3-backed static website, a small Amazon EKS cluster, and a private
PostgreSQL RDS instance for learning Kubernetes, Helm, and AWS networking.

## Prerequisites

- Python 3.11 or newer
- [uv](https://docs.astral.sh/uv/)
- [Pulumi](https://www.pulumi.com/docs/install/)
- AWS CLI, `kubectl`, and Helm
- AWS credentials with permission to manage S3, EKS, EC2, VPC, IAM, RDS, and
  Secrets Manager resources
- A default VPC with subnets in at least two availability zones

## Setup

Install this application's dependencies into the monorepo's shared virtual
environment from the repository root:

```bash
uv sync --package infra
```

The dependency versions are recorded in the root `uv.lock`; this app does not
have a separate lockfile or virtual environment.

## Deploy

Pulumi commands must run from the directory containing `Pulumi.yaml`:

```bash
cd apps/infra
pulumi stack init dev
pulumi preview
pulumi up
```

The stack only needs to be initialized once. On later visits, use
`pulumi stack select dev` instead.

The EKS cluster and its EC2 worker are billable resources. See the complete
[Kubernetes and Helm learning path](../../docs/kubernetes.md) before creating
them, including the kubeconfig setup and cleanup steps.

The development stack uses `us-west-2`. To change it:

```bash
pulumi config set aws:region us-west-2
```

To remove the stack's resources:

```bash
pulumi destroy
```

## Project layout

- `__main__.py`: Pulumi program entry point
- `cluster.py`: small EKS cluster definition
- `certificate.py`: ACM certificate for the public dummy-server hostname
- `load_balancer_controller.py`: IAM role used by the in-cluster ALB controller
- `database.py`: private RDS PostgreSQL instance and dummy-server's secret-reader role
- `policies/load-balancer-controller.json`: controller permissions from AWS's v2.14.1 installation guide
- `website.py`: reusable S3 website component
- `index.html`: website content uploaded to S3
- `kubernetes/hello.yaml`: plain Kubernetes YAML exercise
- `charts/dummy-server`: Helm chart for deploying the dummy FastAPI server
- `Pulumi.yaml`: Pulumi project and uv runtime configuration
- `Pulumi.dev.yaml`: development stack configuration
