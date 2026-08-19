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

## 5. Destroy the cluster

EKS charges continue while the cluster exists, even when no application is
running. Destroy it as soon as the exercise is over:

```bash
cd apps/infra
pulumi destroy
```
