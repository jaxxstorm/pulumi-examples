import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { NodeJS12dXRuntime } from "@pulumi/aws/lambda";

const vpc = new awsx.ec2.Vpc(`lambda-vpc`, {
  cidrBlock: "172.16.0.0/24",
  subnets: [
    {
      type: "private",
    },
    {
      type: "public",
    },
  ],
  tags: {
    Name: `lambda-vpc`,
    Owner: "lbriggs",
    owner: "lbriggs",
  },
});

const role = new aws.iam.Role("lambda", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
        Effect: "Allow",
        Sid: "",
      },
    ],
  }),
});

const rpa = new aws.iam.RolePolicyAttachment("lambda", {
    role: role.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaVPCAccessExecutionRole
})

const securityGroup = new aws.ec2.SecurityGroup("lambda", {
    ingress: [
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    ],
    egress: [
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    ],
    vpcId: vpc.id,
})

const lambda = new aws.lambda.Function("lambda", {
    code: new pulumi.asset.AssetArchive({
        ".": new pulumi.asset.FileArchive("./app"),
    }),
    runtime: NodeJS12dXRuntime,
    role: role.arn,
    handler: "index.handler",
    vpcConfig: {
        subnetIds: vpc.publicSubnetIds,
        securityGroupIds: [ securityGroup.id ], 
    }
})
