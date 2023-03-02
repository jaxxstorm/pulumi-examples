import pulumi
import pulumi_aws as aws
import pulumi_awsx as awsx
import pulumi_tls as tls
import pulumi_cloudinit as cloudinit


config = pulumi.Config()
key_data = config.require("key_data")

vpc = awsx.ec2.Vpc("vpc")

subnet_group = aws.docdb.SubnetGroup("subnet_group", subnet_ids=vpc.private_subnet_ids)

docdb = aws.docdb.Cluster(
    "database",
    engine="docdb",
    master_password="correct-horse-battery-stable",
    master_username="administrator",
    skip_final_snapshot=True,
    db_subnet_group_name=subnet_group.name,
)

sg = aws.ec2.SecurityGroup(
    "allow-ssh",
    vpc_id=vpc.vpc_id,
    description="Allow SSH inbound traffic",
    ingress=[
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp", from_port=22, to_port=22, cidr_blocks=["0.0.0.0/0"]
        )
    ],
    egress=[
        aws.ec2.SecurityGroupEgressArgs(
            protocol="-1", from_port=0, to_port=0, cidr_blocks=["0.0.0.0/0"]
        )
    ],
)

ami = aws.ec2.get_ami(
    most_recent=True,
    owners=["amazon"],
    filters=[
        aws.ec2.GetAmiFilterArgs(name="name", values=["amzn2-ami-hvm-*-x86_64-gp2"])
    ],
)

key = aws.ec2.KeyPair("lbriggs", public_key=key_data)

"""
This function is just a standard function that manipulates strings
You can do anything you want with the function, because when it's called
the values are actually strings
"""


def build_user_data(username: str, password: str) -> str:
    return """#!/bin/bash
    echo USERNAME="{username}" >> /tmp/config.conf
    echo PASSWORD="{password}" >> /tmp/config.conf
""".format(
        username=username, password=password
    )


"""
create an instance with standard string manipulation
"""
instance = aws.ec2.Instance(
    "instance",
    instance_type="t2.micro",
    subnet_id=vpc.public_subnet_ids[0],
    vpc_security_group_ids=[sg.id],
    key_name=key.key_name,
    ami=ami.id,
    # we use Output.all to pass multiple values
    # note, we _resolve_ the values with .apply
    # inside the apply method, the values have been resolved and are
    # valid strings, so we can just call the function above
    user_data=pulumi.Output.all(
        username=docdb.master_username, password=docdb.master_password
    ).apply(lambda args: build_user_data(args["username"], args["password"])),
)

pulumi.export("instance_address", instance.public_ip)

user_data = cloudinit.get_config_output(
    base64_encode=True,
    gzip=True,
    parts=[
        cloudinit.ConfigPartArgs(
            content_type="text/x-shellscript",
            content=pulumi.Output.all(
                username=docdb.master_username, password=docdb.master_password
            ).apply(lambda args: build_user_data(args["username"], args["password"])),
        )
    ],
)

instance = aws.ec2.Instance(
    "instance-1",
    instance_type="t2.micro",
    subnet_id=vpc.public_subnet_ids[0],
    vpc_security_group_ids=[sg.id],
    key_name=key.key_name,
    ami=ami.id,
    # we use Output.all to pass multiple values
    # note, we _resolve_ the values with .apply
    # inside the apply method, the values have been resolved and are
    # valid strings, so we can just call the function above
    user_data=user_data.rendered,
)

pulumi.export("instance_address", instance.public_ip)
