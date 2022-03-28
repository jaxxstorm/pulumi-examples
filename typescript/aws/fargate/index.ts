import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// create a cluster
const cluster = new aws.ecs.Cluster("example");

// define the default vpc info to deploy
const vpc = aws.ec2.getVpcOutput({ default: true });
const subnets = aws.ec2.getSubnetsOutput({
  filters: [
    {
      name: "vpc-id",
      values: [vpc.id],
    },
  ],
});

// create the security groups
const securityGroup = new aws.ec2.SecurityGroup("example", {
  vpcId: vpc.id,
  description: "HTTP access",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
});

// define a loadbalancer
const lb = new aws.lb.LoadBalancer("example", {
  securityGroups: [securityGroup.id],
  subnets: subnets.ids,
});

// target group for port 80
const targetGroupA = new aws.lb.TargetGroup("example-A", {
  port: 80,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.id,
});

// listener for port 80
const listenerA = new aws.lb.Listener("example-A", {
  loadBalancerArn: lb.arn,
  port: 80,
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroupA.arn,
    },
  ],
});

// target group for port 8080
const targetGroupB = new aws.lb.TargetGroup("example-B", {
  port: 8080,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.id,
});

// listener for port 8080
const listenerB = new aws.lb.Listener("example-B", {
  loadBalancerArn: lb.arn,
  port: 80,
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroupB.arn,
    },
  ],
});

const role = new aws.iam.Role("example", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ecs-tasks.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("example", {
  role: role.name,
  policyArn:
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

const taskDefinition = new aws.ecs.TaskDefinition("example", {
  family: "exampleA",
  cpu: "256",
  memory: "512",
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  executionRoleArn: role.arn,
  containerDefinitions: JSON.stringify([
    {
      name: "my-app",
      image: "nginx",
      portMappings: [
        {
          containerPort: 80,
          hostPort: 80,
          protocol: "tcp",
        },
      ],
    },
  ]),
});

const svcA = new aws.ecs.Service("example-A", {
  cluster: cluster.arn,
  desiredCount: 1,
  launchType: "FARGATE",
  taskDefinition: taskDefinition.arn,
  networkConfiguration: {
    assignPublicIp: true,
    subnets: subnets.ids,
    securityGroups: [securityGroup.id],
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroupA.arn,
      containerName: "my-app",
      containerPort: 80,
    },
  ],
});

const svcB = new aws.ecs.Service("example-B", {
    cluster: cluster.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    taskDefinition: taskDefinition.arn,
    networkConfiguration: {
      assignPublicIp: true,
      subnets: subnets.ids,
      securityGroups: [securityGroup.id],
    },
    loadBalancers: [
      {
        targetGroupArn: targetGroupB.arn,
        containerName: "my-app",
        containerPort: 80,
      },
    ],
  });
