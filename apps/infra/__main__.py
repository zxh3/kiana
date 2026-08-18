import pulumi
from website import AwsS3Website

website = AwsS3Website("website")

pulumi.export("website_url", website.url)
