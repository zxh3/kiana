# Kiana infrastructure

This uv application manages Kiana's AWS infrastructure with Pulumi. It creates
an S3-backed static website from `index.html` and exports its URL as
`website_url`.

## Prerequisites

- Python 3.11 or newer
- [uv](https://docs.astral.sh/uv/)
- [Pulumi](https://www.pulumi.com/docs/install/)
- AWS credentials with permission to manage the resources in `website.py`

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
pulumi stack select dev
pulumi preview
pulumi up
```

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
- `website.py`: reusable S3 website component
- `index.html`: website content uploaded to S3
- `Pulumi.yaml`: Pulumi project and uv runtime configuration
- `Pulumi.dev.yaml`: development stack configuration
