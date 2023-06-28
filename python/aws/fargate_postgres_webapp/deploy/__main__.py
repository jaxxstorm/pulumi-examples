"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws
import pulumi_awsx as awsx
import pulumi_random as random
import json

# We need to define a VPC with private and public subnets
vpc = awsx.ec2.Vpc(
    "example-webapp-vpc",
    cidr_block="172.16.0.0/20",
)

# create an ECR repository to store the image
repository = awsx.ecr.Repository(
    "example-webapp",
    force_delete=True,
)

# build the docker image and push it to ECR
image = awsx.ecr.Image(
    "example-webapp",
    repository_url=repository.url,
    path="../",
    dockerfile="../Dockerfile",
    env={"DOCKER_BUILDKIT": "1", "DOCKER_DEFAULT_PLATFORM": "linux/amd64"},
    opts=pulumi.ResourceOptions(parent=repository),
)

# Each RDS instance needs a subnet group
subnet_group = aws.rds.SubnetGroup(
    "example-webapp",
    description="Subnet group for example-webapp",
    subnet_ids=vpc.private_subnet_ids,
)

# A security groups allows the webapp to connect to the database
# it's in the same VPC, so we allow traffic from the VPC CIDR
db_security_group = aws.ec2.SecurityGroup(
    "example-webapp-db",
    description=f"Security group for example webapp database",
    vpc_id=vpc.vpc_id,
    ingress=[
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp",
            from_port=5432,
            to_port=5432,
            cidr_blocks=["172.16.0.0/20"],
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

# generate a random password
password = random.RandomPassword(
    "example-webapp-admin",
    length=20,
    special=False,
)

# provision an RDS instance
database = aws.rds.Instance(
    "example-webapp",
    db_subnet_group_name=subnet_group.name,
    allocated_storage=20,
    db_name="example",
    engine="postgres",
    instance_class="db.t4g.micro",
    engine_version=13.7,
    vpc_security_group_ids=[db_security_group.id],
    username="example",
    password=password.result,
    skip_final_snapshot=True,
    final_snapshot_identifier=f"example-webapp-deleted",
)

# create a security group to allow access to the loadbalancer
lb_security_group = aws.ec2.SecurityGroup(
    "example-webapp-web",
    vpc_id=vpc.vpc_id,
    description=f"Web application security group for example webapp",
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

# create an ECS cluster to run applications
cluster = aws.ecs.Cluster("example-webapp")

# create a loadbalancer, in the public subnets from our VPC
alb = aws.lb.LoadBalancer(
    "example-webapp",
    security_groups=[lb_security_group.id],
    subnets=vpc.public_subnet_ids,
)

# create a target group, with
# which connects to the application
target_group = aws.lb.TargetGroup(
    "example-webapp",
    port=80,
    protocol="HTTP",
    target_type="ip",
    vpc_id=vpc.vpc_id,
    health_check=aws.lb.TargetGroupHealthCheckArgs(
        port=8000,
        protocol="HTTP",
        matcher="200-299", # required because of cors origin
    ),
    opts=pulumi.ResourceOptions(parent=alb),
)

# create a listener which forwards all traffic to the application
wl = aws.lb.Listener(
    "example-webapp",
    load_balancer_arn=alb.arn,
    port=80,
    default_actions=[
        aws.lb.ListenerDefaultActionArgs(
            type="forward",
            target_group_arn=target_group.arn,
        )
    ],
    opts=pulumi.ResourceOptions(parent=alb),
)


# create a log group for the web application
# so we can see what's happening in the app when it runs
log_group = aws.cloudwatch.LogGroup(
    "example-webapp",
    retention_in_days=1,  # reduces costs
)

# allow fargate to run tasks
task_execution_role = aws.iam.Role(
    "example-webapp",
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

# attach the policy to the role
aws.iam.RolePolicyAttachment(
    "example-webapp",
    role=task_execution_role.name,
    policy_arn="arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    opts=pulumi.ResourceOptions(parent=task_execution_role),
)

# we allow all hosts so healthchecks pass
default_allowed_hosts = [ 
    "*",
]


# create a task definition which runs fargate applications
task_definition = aws.ecs.TaskDefinition(
    "example-webapp",
    family="example-webapp",
    network_mode="awsvpc",
    cpu="256",
    memory="512",
    execution_role_arn=task_execution_role.arn,
    task_role_arn=task_execution_role.arn,
    requires_compatibilities=["FARGATE"],
    container_definitions=pulumi.Output.json_dumps(
        [
            {
                "name": "example-webapp",
                "image": image.image_uri,
                "environment": [
                    {
                        "name": "DEFAULT_DATABASE_DB",
                        "value": database.db_name,
                    },
                    {
                        "name": "DEFAULT_DATABASE_HOSTNAME",
                        "value": database.address,
                    },
                    {
                        "name": "DEFAULT_DATABASE_USER",
                        "value": database.username,
                    },
                    {
                        "name": "DEFAULT_DATABASE_PASSWORD",
                        "value": database.password,
                    },
                    {
                        "name": "DEFAULT_DATABASE_PORT",
                        "value": database.port.apply(lambda port: str(port)),
                    },
                    {
                        "name": "FIRST_SUPERUSER_EMAIL",
                        "value": "mail@lbrlabs.com",
                    },
                    {
                        "name": "FIRST_SUPERUSER_PASSWORD",
                        "value": "correct-horse-battery-stable",
                    },
                    {
                        "name": "SECRET_KEY",
                        "value": "super-secret",
                    },
                    {
                        "name": "ALLOWED_HOSTS",
                        "value": pulumi.Output.json_dumps(default_allowed_hosts),
                    }
                ],
                "portMappings": [
                    {
                        "containerPort": 8000,
                        "protocol": "tcp",
                        "name": "http",
                    }
                ],
                "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                        "awslogs-group": log_group.id,
                        "awslogs-region": aws.get_region().name,
                        "awslogs-stream-prefix": "example-webapp",
                    },
                },
            }
        ]
    ),
)

# create a security group that allows the loadbalancer to connect to it
app_security_group = aws.ec2.SecurityGroup(
    "example-webapp-app",
    vpc_id=vpc.vpc_id,
    description=f"Web application security group for example webapp",
    ingress=[
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp",
            from_port=8000,
            to_port=8000,
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

# finally, run the task
service = aws.ecs.Service(
    "example-webapp",
    cluster=cluster.arn,
    desired_count=1,
    launch_type="FARGATE",
    task_definition=task_definition.arn,
    load_balancers=[
        aws.ecs.ServiceLoadBalancerArgs(
            target_group_arn=target_group.arn,
            container_name="example-webapp",
            container_port=8000,
        )
    ],
    network_configuration=aws.ecs.ServiceNetworkConfigurationArgs(
        security_groups=[app_security_group.id],
        assign_public_ip=False,
        subnets=vpc.private_subnet_ids,
    ),
    opts=pulumi.ResourceOptions(parent=task_definition),
)
