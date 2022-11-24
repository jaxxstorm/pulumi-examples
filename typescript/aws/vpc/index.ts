import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const vpc = new awsx.ec2.Vpc("example", {
    cidrBlock: "172.20.0.0/24"
})

export const vpcId = vpc.vpcId
export const privateSubnetIds = vpc.privateSubnetIds
