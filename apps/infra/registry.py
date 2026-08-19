import pulumi
import pulumi_aws as aws


def create_dummy_server_repository() -> aws.ecr.Repository:
    """Create the private container registry used by dummy-server."""
    return aws.ecr.Repository(
        "dummy-server",
        force_delete=True,
        image_scanning_configuration={"scan_on_push": True},
        image_tag_mutability="IMMUTABLE",
        tags={
            "Project": "kiana",
            "Environment": pulumi.get_stack(),
            "ManagedBy": "Pulumi",
        },
    )
