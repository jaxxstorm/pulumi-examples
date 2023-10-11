import os
import pulumi
import pulumi_aws as aws
import json
from pulumi_terraform import state

config = pulumi.Config()
statefile = config.require("statefile")
script_dir = os.path.dirname(os.path.realpath(__file__))

# read outputs from Terraform
s = state.RemoteStateReference(
    "localstate",
    "local",
    state.LocalBackendArgs(path=os.path.join(f"{script_dir}/../tf", statefile)),
)

terraform_owned = aws.ec2.Vpc(
    "terraform_owned",
    cidr_block="10.0.0.0/16",
    enable_dns_hostnames=True,
    tags={
        "Name": "lbriggs",
    },
    opts=pulumi.ResourceOptions(protect=True),
)

# return the outputs from the terraform state
vpc_id = s.get_output("vpc_id")
private_subnet_ids = s.get_output("private_subnets")
public_subnet_ids = s.get_output("public_subnets")

pulumi.export("vpcId", vpc_id)
pulumi.export("publicSubnetIds", private_subnet_ids)
pulumi.export("privateSubnetIds", public_subnet_ids)

#
# Time to use Pulumi!
#

# Create an ECS cluster to run a container-based service.
cluster = aws.ecs.Cluster("cluster")

# create a security group referencing the VPC
group = aws.ec2.SecurityGroup(
    "web-secgrp",
    vpc_id=vpc_id,
    description="Enable HTTP access",
    ingress=[
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp",
            from_port=80,
            to_port=80,
            cidr_blocks=["0.0.0.0/0"],
        )
    ],
    egress=[
        aws.ec2.SecurityGroupEgressArgs(
            protocol="-1",
            from_port=0,
            to_port=0,
            cidr_blocks=["0.0.0.0/0"],
        )
    ],
)

# Create a load balancer to listen for HTTP traffic on port 80.
# Reads the subnet IDs from Terraform state
alb = aws.lb.LoadBalancer(
    "app-lb",
    security_groups=[group.id],
    subnets=public_subnet_ids,
)

# create a target group
atg = aws.lb.TargetGroup(
    "app-tg",
    port=80,
    protocol="HTTP",
    target_type="ip",
    vpc_id=vpc_id,
)

# create a listener
wl = aws.lb.Listener(
    "web",
    load_balancer_arn=alb.arn,
    port=80,
    default_actions=[
        aws.lb.ListenerDefaultActionArgs(
            type="forward",
            target_group_arn=atg.arn,
        )
    ],
)

assume_policy_document = aws.iam.get_policy_document(
    statements=[
        aws.iam.GetPolicyDocumentStatementArgs(
            sid="AssumeRolePolicy",
            effect="Allow",
            principals=[
                aws.iam.GetPolicyDocumentStatementPrincipalArgs(
                    type="Service",
                    identifiers=["ecs-tasks.amazonaws.com"],
                )
            ],
            actions=["sts:AssumeRole"],
        )
    ]
)

# Create an IAM role that can be used by our service's task.
role = aws.iam.Role(
    "task-exec-role",
    assume_role_policy=assume_policy_document.json,
)

rpa = aws.iam.RolePolicyAttachment(
    "task-exec-policy",
    role=role.name,
    policy_arn="arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
)

# Spin up a load balanced service running our container image.
task_definition = aws.ecs.TaskDefinition(
    "app-task",
    family="terraform-state-demo",
    cpu="256",
    memory="512",
    network_mode="awsvpc",
    requires_compatibilities=["FARGATE"],
    execution_role_arn=role.arn,
    container_definitions=json.dumps(
        [
            {
                "name": "nginx",
                "image": "nginx",
                "portMappings": [
                    {"containerPort": 80, "hostPort": 80, "protocol": "tcp"}
                ],
            }
        ]
    ),
)

service = aws.ecs.Service(
    "app-svc",
    cluster=cluster.arn,
    desired_count=3,
    launch_type="FARGATE",
    task_definition=task_definition.arn,
    network_configuration=aws.ecs.ServiceNetworkConfigurationArgs(
        assign_public_ip=True,
        subnets=private_subnet_ids,
        security_groups=[group.id],
    ),
    load_balancers=[
        aws.ecs.ServiceLoadBalancerArgs(
            target_group_arn=atg.arn,
            container_name="nginx",
            container_port=80,
        )
    ],
    opts=pulumi.ResourceOptions(depends_on=[wl]),
)
pulumi.export("url", alb.dns_name)
