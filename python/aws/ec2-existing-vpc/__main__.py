import pulumi
from pulumi_aws import ec2

# Get existing vpc and subnets
vpc = ec2.get_vpc(default=True)
subnets = ec2.get_subnet_ids(vpc_id=vpc.id)

# Create a web security group
group = ec2.SecurityGroup('web-secgrp', ingress=[
    { "protocol": "tcp", "from_port": 80, "to_port": 80, "cidr_blocks": ["0.0.0.0/0"] },
])

for subnet in subnets:
    ec2 = ec2.Instance('instance',
                       instance_type="t2.micro",
                       tags={'Name': 'webserver'},
                       subnet_id=subnet.id,
                       )
    pulumi.export(ec2.id)




