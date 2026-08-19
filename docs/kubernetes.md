# Kubernetes and Helm learning path

This repository uses three layers with separate jobs:

- Pulumi creates the AWS infrastructure and EKS cluster.
- Kubernetes YAML describes the objects that should run in the cluster.
- Helm turns related Kubernetes YAML templates into a configurable package.

The examples use separate namespaces, `learning-yaml` and `dummy-server`, so
they can be installed and removed independently.

## 1. Create the cluster

Install the prerequisites on macOS:

```bash
brew install awscli kubectl helm pulumi uv
aws sts get-caller-identity
```

Install the Python dependencies and inspect the proposed AWS resources:

```bash
uv sync --package infra
cd apps/infra
pulumi stack init dev
pulumi preview
```

The stack only needs to be initialized once. If `dev` already exists, replace
`pulumi stack init dev` with `pulumi stack select dev`.

`pulumi preview` is read-only. `pulumi up` creates billable AWS resources. The
learning cluster uses the account's default VPC, one `t3.medium` worker, and a
standard EKS control plane:

```bash
pulumi up
```

Save the generated Kubernetes credentials in an ignored local file and verify
the connection:

```bash
pulumi stack output kubeconfig --show-secrets > .kubeconfig
export KUBECONFIG="$PWD/.kubeconfig"
kubectl get nodes
```

Keep `KUBECONFIG` set in each terminal that should talk to this cluster.

## 2. Deploy plain Kubernetes YAML

Read `kubernetes/hello.yaml` from top to bottom. It declares four objects:

- `Namespace` gives the example an isolated name scope.
- `ConfigMap` stores a small HTML page.
- `Deployment` keeps one nginx Pod running.
- `Service` gives the replaceable Pod a stable network endpoint.

Apply the desired state and inspect what Kubernetes created:

```bash
kubectl apply -f kubernetes/hello.yaml
kubectl get all -n learning-yaml
kubectl describe deployment hello-yaml -n learning-yaml
```

Forward a local port to the in-cluster Service, then open
<http://localhost:8080>:

```bash
kubectl port-forward -n learning-yaml service/hello-yaml 8080:80
```

Change `replicas` or the HTML in the YAML, run `kubectl apply` again, and watch
Kubernetes reconcile the live cluster to the new desired state:

```bash
kubectl get pods -n learning-yaml --watch
```

Remove this example when finished:

```bash
kubectl delete -f kubernetes/hello.yaml
```

## 3. Deploy dummy-server with Helm

The chart under `charts/dummy-server` deploys the FastAPI application image from
Amazon ECR. Reusable values such as the image repository, image tag, and replica
count live in `values.yaml`.

Render the templates locally before installing anything:

```bash
helm lint charts/dummy-server
helm template dummy-server charts/dummy-server --namespace dummy-server
```

If the previous nginx Helm exercise is still installed, remove that release
before installing its replacement:

```bash
helm uninstall hello-helm -n learning-helm
kubectl delete namespace learning-helm
```

Install the rendered resources as a tracked Helm release:

```bash
helm upgrade --install dummy-server charts/dummy-server \
  --namespace dummy-server \
  --create-namespace
helm list -n dummy-server
kubectl get all -n dummy-server
```

After pushing a new immutable image tag, deploy that version without editing the
chart:

```bash
helm upgrade dummy-server charts/dummy-server \
  --namespace dummy-server \
  --set-string image.tag="<new-image-tag>"
```

Access it at <http://localhost:8081>:

```bash
kubectl port-forward -n dummy-server service/dummy-server 8081:80
```

## 4. Expose dummy-server through an AWS ALB

The public hostname is `dummy-server.kianax.com`. Cloudflare remains the DNS
provider, while AWS Certificate Manager (ACM) provides the TLS certificate and
an Application Load Balancer (ALB) forwards requests into the cluster.

First create the ACM certificate and the controller's IAM role:

```bash
cd apps/infra
pulumi preview
pulumi up
```

Display ACM's validation record:

```bash
pulumi stack output dummy_server_certificate_dns_validation
```

In Cloudflare, add the displayed CNAME record. Keep its proxy status **DNS
only** so ACM can validate and renew the certificate. Then wait for validation:

```bash
CERTIFICATE_ARN="$(pulumi stack output dummy_server_certificate_arn)"
aws acm wait certificate-validated --certificate-arn "$CERTIFICATE_ARN"
```

Install the AWS Load Balancer Controller. Its Kubernetes ServiceAccount uses
the IAM role created by Pulumi, so the controller can create and configure ALBs
without giving those permissions to the application Pod:

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update eks

CLUSTER_NAME="$(pulumi stack output cluster_name)"
CONTROLLER_ROLE_ARN="$(pulumi stack output aws_load_balancer_controller_role_arn)"

helm upgrade --install aws-load-balancer-controller \
  eks/aws-load-balancer-controller \
  --namespace kube-system \
  --version 1.14.0 \
  --set-string clusterName="$CLUSTER_NAME" \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set-string "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn=$CONTROLLER_ROLE_ARN"

kubectl rollout status deployment/aws-load-balancer-controller \
  --namespace kube-system
```

Enable the chart's Ingress and give it the certificate ARN:

```bash
helm upgrade --install dummy-server charts/dummy-server \
  --namespace dummy-server \
  --create-namespace \
  --set ingress.enabled=true \
  --set-string ingress.certificateArn="$CERTIFICATE_ARN"

kubectl get ingress dummy-server --namespace dummy-server --watch
```

Once the `ADDRESS` column contains an AWS hostname, create one more Cloudflare
record:

```text
Type: CNAME
Name: dummy-server
Target: <the ADDRESS shown by kubectl>
Proxy status: DNS only
```

After DNS propagates, verify both the redirect and the application:

```bash
curl -I http://dummy-server.kianax.com
curl https://dummy-server.kianax.com/health
```

Helm can remove every resource in the release as one unit:

```bash
helm uninstall dummy-server -n dummy-server
kubectl delete namespace dummy-server
```

## 5. Connect dummy-server to private PostgreSQL

Pulumi creates a small, single-AZ `db.t4g.micro` PostgreSQL instance in the same
VPC as EKS. The database has no public address. Its security group accepts port
5432 only from the EKS worker security group.

RDS generates the master password and stores it in AWS Secrets Manager. Pulumi
exports the secret's ARN but never reads or stores the password. Creating RDS
can take several minutes, and both RDS and the Secrets Manager secret are
billable:

```bash
cd apps/infra
pulumi preview
pulumi up
```

The Helm chart creates a Kubernetes `ServiceAccount` named `dummy-server`.
Pulumi creates an IAM role whose trust policy allows only that service account
in the `dummy-server` namespace to assume it. The role can perform only
`secretsmanager:GetSecretValue` on this database's one secret.

Pass the non-secret connection settings and the two ARNs to Helm:

```bash
DB_HOST="$(pulumi stack output dummy_server_database_host)"
DB_SECRET_ARN="$(pulumi stack output dummy_server_database_secret_arn)"
DB_ROLE_ARN="$(pulumi stack output dummy_server_database_role_arn)"

helm upgrade dummy-server charts/dummy-server \
  --namespace dummy-server \
  --reset-then-reuse-values \
  --set database.enabled=true \
  --set-string database.host="$DB_HOST" \
  --set-string database.secretArn="$DB_SECRET_ARN" \
  --set-string serviceAccount.roleArn="$DB_ROLE_ARN" \
  --atomic \
  --wait
```

This chart change configures access, but the running image must also contain the
new application code. Build and push a new immutable image tag using the manual
update workflow, then deploy that tag with another `helm upgrade`.

Verify the AWS identity mapping and the database connection:

```bash
kubectl describe serviceaccount dummy-server -n dummy-server
kubectl rollout status deployment/dummy-server -n dummy-server
curl https://dummy-server.kianax.com/db-health
```

The expected response is:

```json
{"status":"ok","database":"connected"}
```

The app caches the secret for five minutes, avoiding a Secrets Manager API call
on every request while still picking up RDS-managed password rotation.

This learning setup connects as the RDS master user. A production application
should instead use a separate PostgreSQL role limited to the tables and actions
the application actually needs.

## 6. Destroy the cluster and database

EKS and RDS charges continue while they exist, even when no application is
running. This learning database has no final snapshot, so `pulumi destroy`
permanently deletes its data:

```bash
cd apps/infra
pulumi destroy
```
