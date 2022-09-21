import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as tailscale from "@pulumi/tailscale";
import * as fs from "fs";
import * as path from "path";

// const config = new pulumi.Config("tailscale")

// const authKey = config.require("bastionAuthKey")

const authKey = new tailscale.TailnetKey("bastion", {
  ephemeral: true,
  preauthorized: true,
  reusable: true,
  tags: ["tag:bastion"],
});

const tailscaleAcl = new tailscale.Acl("bastion", {
  acl: JSON.stringify({
    acls: [
      {
        autoApprovers: {
          routes: {
            "172.20.0.0/22": ["tag:bastion"],
          },
          exitNode: ["tag:bastion"],
        },
      },
    ],
  }),
});

// create a VPC!
const vpc = new awsx.ec2.Vpc("tailscale", {
  cidrBlock: "172.20.0.0/22",
});

// retrieve an existing keypair
const key = aws.ec2.getKeyPairOutput({
  keyName: "lbriggs",
});

// set the tailscale key as an SSM parameter
const tailscaleKey = new aws.ssm.Parameter("tailscale", {
  name: "tailscale-auth-key",
  type: "SecureString",
  value: authKey.key,
});

// create a role for the bastion host
// we allow access to the ec2 principal
// and SSM principal
const role = new aws.iam.Role("bastion", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: ["ec2.amazonaws.com", "ssm.amazonaws.com"],
        },
        Effect: "Allow",
      },
    ],
  }),
});

// allow the instance to retrieve the SSM parameter
const policy = new aws.iam.Policy(
  "tailscale",
  {
    policy: tailscaleKey.arn.apply((key) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: ["ssm:GetParameters"],
            Effect: "Allow",
            Resource: [key],
          },
          {
            Action: ["ssm:DescribeParameters"],
            Effect: "Allow",
            Resource: "*",
          },
        ],
      })
    ),
  },
  { parent: role }
);

new aws.iam.RolePolicyAttachment(
  "ssm-parameter",
  {
    role: role.name,
    policyArn: policy.arn,
  },
  { parent: policy }
);

new aws.iam.RolePolicyAttachment(
  "ssm-manage",
  {
    role: role.name,
    policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  },
  { parent: role }
);

const profile = new aws.iam.InstanceProfile(
  "bastion",
  {
    role: role.name,
  },
  { parent: role }
);

const ami = aws.ec2.getAmiOutput({
  filters: [
    {
      name: "owner-alias",
      values: ["amazon"],
    },
    {
      name: "name",
      values: ["amzn2-ami-hvm*"],
    },
  ],
  mostRecent: true,
});

const sg = new aws.ec2.SecurityGroup(
  "bastion",
  {
    vpcId: vpc.vpcId,
    ingress: [
      {
        protocol: "icmp",
        fromPort: 0,
        toPort: 0,
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
  },
  { parent: vpc }
);

const launchConfiguration = new aws.ec2.LaunchConfiguration("bastion", {
  instanceType: "t3.micro",
  associatePublicIpAddress: false,
  imageId: ami.id,
  keyName: key.keyName as pulumi.Output<string>,
  securityGroups: [sg.id],
  iamInstanceProfile: profile.id,
  userDataBase64: fs.readFileSync(path.resolve(__dirname, "./userdata.init"), {
    encoding: "base64",
  }),
});

const asg = new aws.autoscaling.Group(
  "bastion",
  {
    launchConfiguration: launchConfiguration.id,
    maxSize: 1,
    minSize: 1,
    healthCheckType: "EC2",
    healthCheckGracePeriod: 30,
    vpcZoneIdentifiers: vpc.privateSubnetIds,
  },
  { parent: launchConfiguration }
);

