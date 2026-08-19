import pulumi
from certificate import create_dummy_server_certificate
from cluster import create_cluster
from load_balancer_controller import create_load_balancer_controller_role
from registry import create_dummy_server_repository
from website import AwsS3Website

website = AwsS3Website("website")
cluster = create_cluster()
dummy_server_repository = create_dummy_server_repository()
dummy_server_certificate = create_dummy_server_certificate()
load_balancer_controller_role = create_load_balancer_controller_role(cluster)

pulumi.export("website_url", website.url)
pulumi.export("cluster_name", cluster.eks_cluster.name)
pulumi.export("kubeconfig", pulumi.Output.secret(cluster.kubeconfig_json))
pulumi.export("dummy_server_repository_url", dummy_server_repository.repository_url)
pulumi.export("dummy_server_certificate_arn", dummy_server_certificate.arn)
pulumi.export(
    "dummy_server_certificate_dns_validation",
    dummy_server_certificate.domain_validation_options,
)
pulumi.export(
    "aws_load_balancer_controller_role_arn",
    load_balancer_controller_role.arn,
)
