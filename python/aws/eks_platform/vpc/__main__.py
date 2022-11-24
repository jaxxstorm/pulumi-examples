"""An AWS Python Pulumi program"""

import pulumi
import pulumi_awsx as awsx 

# create a vpc
vpc = awsx.ec2.Vpc(
    "vpc", cidr_block="172.16.0.0/22"
)

pulumi.export("vpc_id", vpc.vpc_id)
pulumi.export("public_subnet_ids", vpc.public_subnet_ids)
pulumi.export("private_subnet_ids", vpc.private_subnet_ids)
