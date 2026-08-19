import json

import pulumi
from certificate import create_dummy_server_certificate
from cluster import create_cluster
from load_balancer_controller import _build_assume_role_policy
from pulumi.runtime import MockCallArgs, MockResourceArgs, Mocks, set_mocks
from registry import create_dummy_server_repository


class InfraMocks(Mocks):
    def new_resource(self, args: MockResourceArgs) -> tuple[str, dict]:
        outputs = dict(args.inputs)
        outputs.setdefault("name", args.name)
        outputs.setdefault("kubeconfigJson", "{}")
        return f"{args.name}-id", outputs

    def call(self, args: MockCallArgs) -> tuple[dict, list[tuple[str, str]]]:
        if args.token == "aws:ec2/getVpc:getVpc":
            return {"default": True, "id": "vpc-default"}, []
        if args.token == "aws:ec2/getSubnets:getSubnets":
            return {"ids": ["subnet-a", "subnet-b"]}, []
        return {}, []


set_mocks(InfraMocks())


@pulumi.runtime.test
def test_program_constructs_eks_cluster() -> None:
    assert create_cluster() is not None


@pulumi.runtime.test
def test_program_constructs_dummy_server_repository() -> None:
    assert create_dummy_server_repository() is not None


@pulumi.runtime.test
def test_program_constructs_dummy_server_certificate() -> None:
    assert create_dummy_server_certificate() is not None


def test_load_balancer_controller_trust_policy() -> None:
    issuer = "oidc.eks.us-west-2.amazonaws.com/id/example"
    policy = json.loads(
        _build_assume_role_policy(
            {
                "provider_arn": "arn:aws:iam::123456789012:oidc-provider/example",
                "issuer": issuer,
            }
        )
    )

    statement = policy["Statement"][0]
    assert statement["Principal"]["Federated"].endswith("oidc-provider/example")
    assert statement["Condition"]["StringEquals"] == {
        f"{issuer}:aud": "sts.amazonaws.com",
        f"{issuer}:sub": (
            "system:serviceaccount:kube-system:aws-load-balancer-controller"
        ),
    }
