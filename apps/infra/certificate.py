import pulumi
import pulumi_aws as aws

DUMMY_SERVER_DOMAIN = "dummy-server.kianax.com"


def create_dummy_server_certificate() -> aws.acm.Certificate:
    """Request the TLS certificate used by dummy-server's public ALB."""
    return aws.acm.Certificate(
        "dummy-server",
        domain_name=DUMMY_SERVER_DOMAIN,
        validation_method="DNS",
        tags={
            "Project": "kiana",
            "Environment": pulumi.get_stack(),
            "ManagedBy": "Pulumi",
        },
    )
