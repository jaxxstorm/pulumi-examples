from pulumi import (
    ComponentResource,
    ResourceOptions,
    Inputs,
    export
)

from pulumi_aws.ec2 import (
    Vpc,
    Subnet
)

from pulumi_aws.s3 import Bucket

from typing import Optional

class VpcComponent(ComponentResource):
    vpc: Vpc
    subnet: Subnet

    def __init__(self, name: str, props: Optional["Inputs"] = None, opts: Optional[ResourceOptions] = None) -> None:
        super().__init__("phile:pkg:Vpc", name, props, opts)

        options = ResourceOptions.merge(opts, ResourceOptions(
            parent=self
        ))

        self.vpc = Vpc("vpc", cidr_block="10.25.0.0/16", opts=options)
        self.subnet = Subnet("sub1", vpc_id=self.vpc.id, cidr_block="10.25.0.0/24", opts=options)


vpc = VpcComponent("vpc-comp")

# Create an AWS resource (S3 Bucket)
bucket = Bucket('my-bucket', opts=ResourceOptions(depends_on=vpc))

# Export the name of the bucket