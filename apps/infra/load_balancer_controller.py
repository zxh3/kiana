import json
from pathlib import Path
from typing import Any, cast

import pulumi
import pulumi_aws as aws
import pulumi_eks as eks

SERVICE_ACCOUNT_NAMESPACE = "kube-system"
SERVICE_ACCOUNT_NAME = "aws-load-balancer-controller"


def _build_assume_role_policy(oidc: dict[str, str]) -> str:
    issuer = oidc["issuer"]
    return json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"Federated": oidc["provider_arn"]},
                    "Action": "sts:AssumeRoleWithWebIdentity",
                    "Condition": {
                        "StringEquals": {
                            f"{issuer}:aud": "sts.amazonaws.com",
                            f"{issuer}:sub": (
                                "system:serviceaccount:"
                                f"{SERVICE_ACCOUNT_NAMESPACE}:{SERVICE_ACCOUNT_NAME}"
                            ),
                        }
                    },
                }
            ],
        }
    )


def create_load_balancer_controller_role(cluster: eks.Cluster) -> aws.iam.Role:
    """Give the in-cluster AWS Load Balancer Controller AWS permissions."""
    oidc = pulumi.Output.all(
        provider_arn=cluster.oidc_provider_arn,
        issuer=cluster.oidc_issuer,
    )
    # Work around ty's current overload-resolution issue with Pulumi Output.apply.
    assume_role_policy: pulumi.Output[str] = cast(Any, oidc).apply(
        _build_assume_role_policy
    )

    role = aws.iam.Role(
        "aws-load-balancer-controller",
        assume_role_policy=assume_role_policy,
        tags={
            "Project": "kiana",
            "Environment": pulumi.get_stack(),
            "ManagedBy": "Pulumi",
        },
    )
    policy = aws.iam.Policy(
        "aws-load-balancer-controller",
        description="Permissions for the EKS AWS Load Balancer Controller",
        policy=(Path(__file__).parent / "policies/load-balancer-controller.json").read_text(),
        tags={
            "Project": "kiana",
            "Environment": pulumi.get_stack(),
            "ManagedBy": "Pulumi",
        },
    )
    aws.iam.RolePolicyAttachment(
        "aws-load-balancer-controller",
        role=role.name,
        policy_arn=policy.arn,
    )

    return role
