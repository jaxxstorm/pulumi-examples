from webserver import WebServer, WebServerArgs
import pulumi_aws as aws
import pulumi

vpc = aws.ec2.get_vpc(default=True)
subnets = aws.ec2.get_subnets(filters=[{"name": "vpc-id", "values": [vpc.id]}])

ami = aws.ec2.get_ami(
    owners=["amazon"],
    most_recent=True,
    filters=[
        aws.ec2.GetAmiFilterArgs(
            name="name",
            values=["amzn2-ami-hvm-2.0.*-x86_64-gp2"],
        )
    ],
)

webserver = WebServer(
    "lbriggs",
    WebServerArgs(
        instance_type="t3.micro", vpc_id=vpc.id, subnet_ids=subnets.ids, ami_id=ami.id
    ),
)

pulumi.export("lb_dns_name", webserver.lb.dns_name)
