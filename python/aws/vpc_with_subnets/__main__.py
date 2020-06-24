import pulumi_aws

# Create a VPC
vpc = pulumi_aws.ec2.Vpc('my-vpc', cidr_block="10.0.0.0/16")

# Get all the availability zones
zones = pulumi_aws.get_availability_zones()

subnet_ids = []

# Loop through all the zones and create a subnet in each
for zone in zones.names:
    vpc_subnet = pulumi_aws.ec2.Subnet(
        f'vpc-subnet-{zone}',
        vpc_id=vpc.id,
        cidr_block=f'10.100.{len(subnet_ids)}.0/24',
        availability_zone=zone
    )
    subnet_ids.append(vpc_subnet.id)

