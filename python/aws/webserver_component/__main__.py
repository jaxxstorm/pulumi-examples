"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws
from webserver import WebServer, WebServerArgs

vpc = aws.ec2.get_vpc(default=True)
subnets = aws.ec2.get_subnets(filters=[{"name": "vpc-id", "values": [vpc.id]}])

ami = aws.ec2.get_ami(
    owners=["amazon"],
    most_recent=True,
    filters=[
        aws.ec2.GetAmiFilterArgs(name="name", values=["amzn2-ami-hvm-2.0.*-x86_64-gp2"])
    ],
)

webserver = WebServer(
    "lbriggs",
    WebServerArgs(
        instance_type="t3.micro", vpc_id=vpc.id, ami_id=ami.id, subnets_ids=subnets.ids
    ),
)

pulumi.export("lb_dns_name", webserver.lb.dns_name)
pulumi.export("servers", webserver.servers[0].public_ip)