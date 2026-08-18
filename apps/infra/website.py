import pulumi
from pulumi_aws import s3


class AwsS3Website(pulumi.ComponentResource):
    def __init__(self, name: str, files: list[str] | None = None, opts=None):
        super().__init__("quickstart:index:AwsS3Website", name, {"files": files}, opts)

        bucket = s3.Bucket("my-bucket", opts=pulumi.ResourceOptions(parent=self))
        website = s3.BucketWebsiteConfiguration(
            "website",
            bucket=bucket.id,
            index_document={
                "suffix": "index.html",
            },
            opts=pulumi.ResourceOptions(parent=self),
        )

        ownership_controls = s3.BucketOwnershipControls(
            "ownership-controls",
            bucket=bucket.id,
            rule={
                "object_ownership": "ObjectWriter",
            },
            opts=pulumi.ResourceOptions(parent=self),
        )

        public_access_block = s3.BucketPublicAccessBlock(
            "public-access-block",
            bucket=bucket.id,
            block_public_acls=False,
            opts=pulumi.ResourceOptions(parent=self),
        )

        if files is None:
            files = ["index.html"]

        for file in files:
            s3.BucketObject(
                file,
                bucket=bucket.id,
                source=pulumi.FileAsset(file),
                content_type="text/html",
                acl="public-read",
                opts=pulumi.ResourceOptions(
                    depends_on=[ownership_controls, public_access_block], parent=self
                ),
            )

        self.url = pulumi.Output.concat("http://", website.website_endpoint)

        self.register_outputs(
            {
                "url": self.url,
            }
        )
