import pulumi
from cluster import create_cluster
from registry import create_dummy_server_repository
from website import AwsS3Website

website = AwsS3Website("website")
cluster = create_cluster()
dummy_server_repository = create_dummy_server_repository()

pulumi.export("website_url", website.url)
pulumi.export("cluster_name", cluster.eks_cluster.name)
pulumi.export("kubeconfig", pulumi.Output.secret(cluster.kubeconfig_json))
pulumi.export("dummy_server_repository_url", dummy_server_repository.repository_url)
