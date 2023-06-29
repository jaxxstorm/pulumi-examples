"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws

# get an existing VPC
vpc = aws.ec2.get_vpc(id="vpc-0ce7ca6f611a0531b")

# retrieve all subnets from this vpc
# you can narrow this down using more filters: http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeSubnets.html
subnets = aws.ec2.get_subnets(filters=[
    aws.ec2.GetSubnetsFilterArgs(
        name="vpc-id",
        values=[vpc.id],
    )
])
pulumi.export("vpc_subnets", subnets.ids)

# get all the routes for this vpc, including yhe default route
vpc_routes = aws.ec2.get_route_tables(vpc_id=vpc.id)
pulumi.export("vpc_routes", vpc_routes.ids)


# get all the routes for each subnet distinctly
subnet_routes: str = []
for subnet in subnets.ids:
    route = aws.ec2.get_route_tables(filters=[
        aws.ec2.GetRouteTableFilterArgs(
            name="association.subnet-id",
            values=[subnet],
        )
    ])
    
    subnet_routes.append(route.ids[0])

pulumi.export("subnet_routes", subnet_routes)


