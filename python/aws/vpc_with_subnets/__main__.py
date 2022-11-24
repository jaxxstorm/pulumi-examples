import pulumi_aws
import pulumi

# Create a VPC
vpc = pulumi_aws.ec2.Vpc('my-vpc', cidr_block="172.16.0.0/16")

# Get all the availability zones
zones = pulumi_aws.get_availability_zones()

subnet_ids = []

# Loop through all the zones and create a subnet in each
for zone in zones.names:
    vpc_subnet = pulumi_aws.ec2.Subnet(
        f'vpc-subnet-{zone}',
        vpc_id=vpc.id,
        cidr_block=f'172.16.{len(subnet_ids)}.0/24',
        availability_zone=zone
    )
    subnet_ids.append(vpc_subnet.id)

pulumi.export('subnet_ids', subnet_ids)