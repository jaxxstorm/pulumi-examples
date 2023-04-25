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
    
    # Get the account ID for any given provider to use later during peering
    account_id = aws.get_caller_identity(opts=pulumi.InvokeOptions(provider=provider, parent=provider)).account_id
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
        # Append the information we need to use later for peering
        vpcs.append({"vpc_name":regional_vpc_name, "vpc_id": vpc.vpc_id, "region": region, "account_id": account_id})
        

pulumi.export("vpcs", vpcs)

# loop through all the VPC
for i, requesting_vpc in enumerate(vpcs):
    # Start the second loop from the next index to avoid duplicate pairings and self-pairing
    for j in range(i + 1, len(vpcs)):
        accepting_vpc = vpcs[j]
        pulumi.log.info(f"Creating VPC peering connection between {requesting_vpc['vpc_name']} and {accepting_vpc['vpc_name']}", ephemeral=True)
        
        # get the provider from the vpc list
        request_provider = aws.Provider(f"request-provider-{requesting_vpc['vpc_name']}-{accepting_vpc['vpc_name']}", region=requesting_vpc['region'])
        accept_provider = aws.Provider(f"accept-provider-{accepting_vpc['vpc_name']}-{requesting_vpc['vpc_name']}", region=accepting_vpc['region'])
        
        requestor = aws.ec2.VpcPeeringConnection(
            f"{requesting_vpc['vpc_name']}-to-{accepting_vpc['vpc_name']}",
            vpc_id=requesting_vpc['vpc_id'],
            peer_vpc_id=accepting_vpc['vpc_id'],
            peer_owner_id=accepting_vpc['account_id'],
            peer_region=accepting_vpc['region'],
            auto_accept=False, # can't auto accept from 
            # NOTE: this doesn't work until successful peering has happened
            # This is an API limitation, add this after peering is complete
            # requester=aws.ec2.VpcPeeringConnectionRequesterArgs(
            #     allow_remote_vpc_dns_resolution=True,
            # ),
            opts=pulumi.ResourceOptions(provider=request_provider, parent=request_provider),   
        )
        
        acceptor = aws.ec2.VpcPeeringConnectionAccepter(
            f"{requesting_vpc['vpc_name']}-to-{accepting_vpc['vpc_name']}",
            vpc_peering_connection_id=requestor.id,
            auto_accept=True,
            accepter=aws.ec2.VpcPeeringConnectionAccepterArgs(
                allow_remote_vpc_dns_resolution=True,
            ),
            
            opts=pulumi.ResourceOptions(provider=accept_provider, parent=accept_provider),
        )