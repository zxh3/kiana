import pulumi
from cluster import create_cluster
from website import AwsS3Website

website = AwsS3Website("website")
cluster = create_cluster()

pulumi.export("website_url", website.url)
pulumi.export("cluster_name", cluster.eks_cluster.name)
pulumi.export("kubeconfig", pulumi.Output.secret(cluster.kubeconfig_json))
