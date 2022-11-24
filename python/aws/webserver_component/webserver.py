import pulumi
import pulumi_aws as aws


class WebServerArgs:
    def __init__(
        self,
        instance_type: pulumi.Input[str],
        vpc_id: pulumi.Input[str],
        subnets_ids: list[str],
        ami_id: str,
    ):
        self.instance_type = instance_type
        self.vpc_id = vpc_id
        self.subnet_ids = subnets_ids
        self.ami_id = ami_id


class WebServer(pulumi.ComponentResource):

    security_group: aws.ec2.SecurityGroup
    servers: list[aws.ec2.Instance] = []
    lb: aws.lb.LoadBalancer

    def __init__(
        self, name: str, args: WebServerArgs, opts: pulumi.ResourceOptions = None
    ):
        super().__init__("custom:app:WebServer", name, {}, opts)

        self.security_group = aws.ec2.SecurityGroup(
            f"{name}-sg",
            vpc_id=args.vpc_id,
            ingress=[
                {
                    "protocol": "tcp",
                    "from_port": 80,
                    "to_port": 80,
                    "cidr_blocks": ["0.0.0.0/0"],
                }
            ],
            egress=[
                {
                    "protocol": "tcp",
                    "from_port": 80,
                    "to_port": 80,
                    "cidr_blocks": ["0.0.0.0/0"],
                }
            ],
            opts=pulumi.ResourceOptions(parent=self),
        )

        self.lb = aws.lb.LoadBalancer(
            f"{name}-lb",
            security_groups=[self.security_group.id],
            subnets=args.subnet_ids,
            load_balancer_type="application",
            opts=pulumi.ResourceOptions(parent=self),
        )

        target_group = aws.lb.TargetGroup(
            f"{name}-tg",
            port=80,
            protocol="HTTP",
            target_type="ip",
            vpc_id=args.vpc_id,
            opts=pulumi.ResourceOptions(parent=self),
        )

        listener = aws.lb.Listener(
            f"{name}-listener",
            load_balancer_arn=self.lb.arn,
            port=80,
            default_actions=[
                aws.lb.ListenerDefaultActionArgs(
                    type="forward",
                    target_group_arn=target_group.arn,
                )
            ],
            opts=pulumi.ResourceOptions(parent=self.lb),
        )

        for i, subnet_id in enumerate(args.subnet_ids, start=0):
            server = aws.ec2.Instance(
                f"{name}-webserver-{i}",
                instance_type=args.instance_type,
                vpc_security_group_ids=[self.security_group.id],
                ami=args.ami_id,
                subnet_id=subnet_id,
                opts=pulumi.ResourceOptions(parent=self),
            )
            self.servers.append(server)
            
            attachment = aws.lb.TargetGroupAttachment(
                f"{name}-tg-attachment-{i}",
                target_group_arn=target_group.arn,
                target_id=server.private_ip,
                port=80,
                opts=pulumi.ResourceOptions(parent=target_group),
            )
