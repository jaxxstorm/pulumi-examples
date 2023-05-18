"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws
import boto3

ami = aws.ec2.get_ami(
    most_recent="true",
    owners=["amazon"],
    filters=[{"name":"name","values":["amzn-ami-hvm-*-x86_64-ebs"]}])

def wait_for_instance_running(instance_id):
    ec2 = boto3.client('ec2')
    
    pulumi.log.info(
        msg="Waiting for Instance to pass healthchecks",
        ephemeral=True,
    )

    waiter = ec2.get_waiter('instance_status_ok')
    waiter.wait(InstanceIds=[instance_id])
    
    pulumi.log.info(msg="Instance is running and passed healthchecks", ephemeral=True)


# Create and launch an EC2 instance into the public subnet.
server = aws.ec2.Instance("server",
    instance_type="t3.micro",
    ami=ami.id,
    tags={
        "Name": "webserver",
    })

server.id.apply(lambda instance_id: wait_for_instance_running(instance_id))
