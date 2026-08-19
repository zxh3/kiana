import pulumi
import pulumi_eks as eks
from pulumi_aws.ec2.get_subnets import get_subnets
from pulumi_aws.ec2.get_vpc import get_vpc


def create_cluster() -> eks.Cluster:
    """Create a small EKS cluster for learning Kubernetes and Helm."""
    default_vpc = get_vpc(default=True)
    default_subnets = get_subnets(
        filters=[
            {
                "name": "vpc-id",
                "values": [default_vpc.id],
            }
        ]
    )

    return eks.Cluster(
        "kiana-cluster",
        vpc_id=default_vpc.id,
        subnet_ids=default_subnets.ids,
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
