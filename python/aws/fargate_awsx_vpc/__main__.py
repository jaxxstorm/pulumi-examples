"""JAXXStorm's Python Pulumi example program."""

from pulumi import export, ResourceOptions
import pulumi
import pulumi_awsx as awsx
import pulumi_aws as aws
import json

# Create an ECS cluster to run a container-based service.
cluster = aws.ecs.Cluster("cluster")

# Read back the **custom** VPC and public subnets, which we will use.
custom_vpc = awsx.ec2.Vpc(
    "custom-vpc",
    number_of_availability_zones=2,
    nat_gateways=0)

# Create a SecurityGroup that permits HTTP ingress and unrestricted egress.
group = aws.ec2.SecurityGroup(
    "web-secgrp",
    vpc_id=custom_vpc.vpc.id,
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
alb = aws.lb.LoadBalancer(
    "app-lb",
    security_groups=[group.id],
    subnets=custom_vpc.public_subnet_ids,
)

atg = aws.lb.TargetGroup(
    "app-tg",
    port=80,
    protocol="HTTP",
    target_type="ip",
    vpc_id=custom_vpc.vpc.id,
    opts=pulumi.ResourceOptions(parent=alb),
)

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
    opts=pulumi.ResourceOptions(parent=alb),
)

# Create an IAM role that can be used by our service's task.
role = aws.iam.Role(
    "task-exec-role",
    assume_role_policy=json.dumps(
        {
            "Version": "2008-10-17",
            "Statement": [
                {
                    "Sid": "",
                    "Effect": "Allow",
                    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
                    "Action": "sts:AssumeRole",
                }
            ],
        }
    ),
)

rpa = aws.iam.RolePolicyAttachment(
    "task-exec-policy",
    role=role.name,
    policy_arn="arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    opts=pulumi.ResourceOptions(parent=role),
)

# Spin up a load balanced service running our container image.
task_definition = aws.ecs.TaskDefinition(
    "app-task",
    family="app-task",
    cpu="256",
    memory="512",
    network_mode="awsvpc",
    requires_compatibilities=["FARGATE"],
    execution_role_arn=role.arn,
    container_definitions=pulumi.Output.all(lb_one=alb.dns_name).apply(
        lambda args: json.dumps(
            [
                {
                    "name": "my-app",
                    "image": "nginx",
                    "portMappings": [
                        {"containerPort": 80, "hostPort": 80, "protocol": "tcp"}
                    ],
                    "environment": [
                        {"name": "LOADBALANCER", "value": args["lb_one"]},
                    ],
                }
            ]
        ),
    ),
    opts=pulumi.ResourceOptions(parent=cluster),
)

service = aws.ecs.Service(
    "app-svc",
    cluster=cluster.arn,
    desired_count=3,
    launch_type="FARGATE",
    task_definition=task_definition.arn,
    network_configuration=aws.ecs.ServiceNetworkConfigurationArgs(
        assign_public_ip=True,
        subnets=custom_vpc.private_subnet_ids,
        security_groups=[group.id],
    ),
    load_balancers=[
        aws.ecs.ServiceLoadBalancerArgs(
            target_group_arn=atg.arn,
            container_name="my-app",
            container_port=80,
        )
    ],
    opts=ResourceOptions(depends_on=[wl], parent=cluster),
)

export("cluster", cluster.name)
export("url", alb.dns_name)
export("sgName", group.name)
