import pulumi
import pulumi_eks as eks


def create_cluster() -> eks.Cluster:
    """Create a small EKS cluster for learning Kubernetes and Helm."""
    return eks.Cluster(
        "kiana-cluster",
        instance_type="t3.medium",
        desired_capacity=1,
        min_size=1,
        max_size=2,
        node_root_volume_encrypted=True,
        tags={
            "Project": "kiana",
            "Environment": pulumi.get_stack(),
            "ManagedBy": "Pulumi",
        },
    )
