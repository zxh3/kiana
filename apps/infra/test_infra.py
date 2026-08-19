import pulumi
from cluster import create_cluster
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
