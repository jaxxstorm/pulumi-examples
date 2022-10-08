import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";


const vpc = new awsx.ec2.Vpc("example", {
    cidrBlock: "172.20.0.0/22"
})

export const vpcId = vpc.vpcId
export const privateSubnetIds = vpc.privateSubnetIds

const sg = new aws.rds.SubnetGroup("example", {
    subnetIds: vpc.privateSubnetIds,
})

const securityGroup = new aws.ec2.SecurityGroup("example", {
    description: "all",
    vpcId: vpc.vpcId,
    ingress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ]
})

const db = new aws.rds.Instance("example", {
    engine: "mysql",
    allocatedStorage: 10,
    skipFinalSnapshot: true,
    engineVersion: "5.7",
    username: "lbriggs",
    password: "correct-horse-battery-stable",
    dbName: "example",
    instanceClass: aws.rds.InstanceType.T3_Micro,
    parameterGroupName: "default.mysql5.7",
    dbSubnetGroupName: sg.name,
    vpcSecurityGroupIds: [ securityGroup.id ]
})

export const address = db.address

