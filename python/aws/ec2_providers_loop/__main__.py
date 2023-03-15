"""An AWS Python Pulumi program"""
import pulumi_aws as aws
import pulumi

regions = ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1"]
hostnames = []

for region in regions:
    provider = aws.Provider(f"provider-{region}", region=region)

    ubuntu = aws.ec2.get_ami_output(
        most_recent=True,
        filters=[
            aws.ec2.GetAmiFilterArgs(
                name="name",
                values=["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"],
            ),
            aws.ec2.GetAmiFilterArgs(
                name="virtualization-type",
                values=["hvm"],
            ),
        ],
        owners=["099720109477"],
        opts=pulumi.InvokeOptions(provider=provider, parent=provider),
    )

    instance = aws.ec2.Instance(
        f"instance-{region}", 
        ami=ubuntu.id,
        instance_type="t3.micro",
        associate_public_ip_address=True,
        opts=pulumi.ResourceOptions(provider=provider, parent=provider),
    )
    
    hostnames.append(instance.private_dns)
    
    
pulumi.export("hostnames", hostnames)
