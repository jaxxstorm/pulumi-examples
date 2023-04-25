import pulumi
import pulumi_aws as aws
import pulumi_awsx as awsx

stack = pulumi.get_stack()
project = pulumi.get_project()
cfg = pulumi.config.Config("network")
data = cfg.get_object("data")
regions = data["regions"]
vpcs = []

for region, vpc_data in regions.items():
    provider = aws.Provider(f"aws-{region}", region=region)
    # the primary VPC is the first one in the list
    # FIXME: we should select the vpc by its key name
    main_vpc = vpc_data[0].items()
    for vpc_name, vpc_config in main_vpc:
        regional_vpc_name = f'{stack}-{vpc_config["vpc-name"]}'
        vpc = awsx.ec2.Vpc(
            regional_vpc_name,
            cidr_block=vpc_config["cidr"],
            tags={
                "managed_by": "Pulumi",
                "project": f"{project}",
                "environment": f"{stack}",
                "region": f"{region}",
            },
            opts=pulumi.ResourceOptions(provider=provider, parent=provider),
            nat_gateways=awsx.ec2.NatGatewayConfigurationArgs(
                strategy=awsx.ec2.NatGatewayStrategy.ONE_PER_AZ
            ),
            subnet_specs=[
                awsx.ec2.SubnetSpecArgs(
                    type=awsx.ec2.SubnetType.PRIVATE,
                    cidr_mask=24,
                    name="app",
                    tags={
                        "managed_by": "Pulumi",
                        "project": f"{project}",
                        "environment": f"{stack}",
                        "vpc": regional_vpc_name,
                        "subnet_type": "app-private",
                    },
                ),
                awsx.ec2.SubnetSpecArgs(
                    type=awsx.ec2.SubnetType.PRIVATE,
                    cidr_mask=24,
                    name="data",
                    tags={
                        "managed_by": "Pulumi",
                        "project": f"{project}",
                        "environment": f"{stack}",
                        "vpc": regional_vpc_name,
                        "subnet_type": "data-private",
                    },
                ),
                awsx.ec2.SubnetSpecArgs(
                    type=awsx.ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                    name="public",
                    tags={
                        "kubernetes.io/role/elb": "1",
                        "managed_by": "Pulumi",
                        "project": f"{project}",
                        "environment": f"{stack}",
                        "vpc": regional_vpc_name,
                        "subnet_type": "public",
                    },
                ),
            ],
        )
        vpcs.append({"vpc_name":regional_vpc_name, "vpc_id": vpc.vpc_id, "region": region, "provider": provider})
        

pulumi.export("vpcs", vpcs)

for vpc in vpcs:
    provider = vpc.provider
    
    
    

# for region, vpc_data in regions.items():
#     provider = aws.Provider(f"aws-{region}", region=region)
#     for vpc_name, vpc_config in vpc_data[0].items():
#         # Create VPC First
#         vname = f'{stack}-{vpc_config["vpc-name"]}'

#         vpcs[f"{vname}-{region}"] = vpc

#         pulumi.export(f'{vname}-vpc_id', vpc.vpc_id)
#         pulumi.export(f'{vname}-public_subnet_ids', vpc.public_subnet_ids)
#         pulumi.export(f'{vname}-private_subnet_ids', vpc.private_subnet_ids)

# for region, vpc_data in regions.items():
#     for vpc_name, vpc_config in vpc_data[0].items():
#         current_vpc = vpcs[f'{stack}-{vpc_config["vpc-name"]}-{region}']
#     cprovider = aws.Provider(f"aws-{current_vpc}", region=region)
#     # Loop through the other regions and peer the VPCs
#     for other_region, other_vpc_data in regions.items():

#         if other_region != region:
#             for other_vpc_config in vpc_data[0].items():
#                 account = aws.get_caller_identity()
#                 if 'account_id' not in other_vpc_config[0]:
#                     print('using current account id')
#                     peer_owner_id = account.account_id
#                 else:
#                     print('using configured peer account number')
#                     peer_owner_id = other_vpc_config[0]['account_id']

#                 # Get the other VPC resource
#                 print(vpcs['state-network-east-us-east-1'])
#                 other_vpc = vpcs[f"{stack}-{other_vpc_config['vpc-name']}-{other_region}"]
#                 oprovider=aws.Provider(f"provider-{other_region}", region=other_region)
#                 # Create a peering connection between the VPCs
#                 pcx = aws.ec2.VpcPeeringConnection(f"{current_vpc.id}-{other_vpc.id}",
#                                         vpc_id=current_vpc.id,
#                                         peer_vpc_id=other_vpc.id,
#                                         peer_owner_id=peer_owner_id,
#                                         opts=pulumi.ResourceOptions(provider=oprovider),
#                                         accepter=aws.ec2.VpcPeeringConnectionAccepterArgs(
#                                             allow_remote_vpc_dns_resolution=True,
#                                             allow_classic_link_to_remote_vpc=True,
#                                             allow_vpc_to_remote_classic_link=True
#                                         ),
#                                         requester=aws.ec2.VpcPeeringConnectionRequesterArgs(
#                                             allow_remote_vpc_dns_resolution=True,
#                                             allow_classic_link_to_remote_vpc=True,
#                                             allow_vpc_to_remote_classic_link=True
#                                         ))

#                 # Create a route from the current VPC to the other VPC
#                 route = awsx.ec2.Route(
#                     f"{current_vpc.id}-{other_vpc.id}",
#                     name=f"{current_vpc.id}-{other_vpc.id}",
#                     route_table_id=current_vpc.default_route_table_id,
#                     destination_cidr_block=other_vpc.cidr_block,
#                     vpc_peering_connection_id=pcx.id,
#                     provider=cprovider
#                 )

#                 pulumi.export(f"{current_vpc.id}-{other_vpc.id}-peer-id", pcx.id)
#                 pulumi.export(f"{current_vpc.id}-{other_vpc.id}-route-id", route.id)
