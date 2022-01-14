"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws
import pulumi_tls as tls

ssh_key = tls.PrivateKey("generated", 
    algorithm="RSA",
    rsa_bits=4096,
)

aws_key = aws.ec2.KeyPair("generated",
    public_key=ssh_key.public_key_openssh,
    opts=pulumi.ResourceOptions(parent=ssh_key)
)

ec2_instance = aws.cloudformation.Stack("ec2-instance",
    template_url="https://s3.us-west-2.amazonaws.com/cloudformation-templates-us-west-2/EC2InstanceWithSecurityGroupSample.template",
    parameters={
        "KeyName": aws_key.key_name
    }
)

cluster = aws.cloudformation.get_stack(
    name="lbriggs-87c98b5e"
)

asg = aws.autoscaling.get_group(name=cluster.outputs["NodeGroup"])



pulumi.export("address", ec2_instance.outputs["PublicDNS"])
pulumi.export("availabilityZones", asg.availability_zones)
