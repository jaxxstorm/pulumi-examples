"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws
import pulumi_awsx as awsx

cluster = aws.ecs.Cluster("example")

lb = awsx.lb.ApplicationLoadBalancer(
    "example",
    default_target_group=awsx.lb.TargetGroupArgs(
        port=8080
    )
)

service = awsx.ecs.FargateService(
    "example",
    cluster=cluster.arn,
    desired_count=2,
    task_definition_args=awsx.ecs.FargateServiceTaskDefinitionArgs(
        container=awsx.ecs.TaskDefinitionContainerDefinitionArgs(
            image="danjellz/http-server",
            cpu=512,
            memory=128,
            essential=True,
            port_mappings=[
                awsx.ecs.TaskDefinitionPortMappingArgs(
                    host_port=8080,
                    container_port=8080,
                    target_group=lb.default_target_group,
                )
            ],
        )
    ),
)

target_group_attachment = awsx.lb.TargetGroupAttachment(
    "example",
    
)

pulumi.export("cluster_name", cluster.name)
pulumi.export("task_def", service.task_definition)
