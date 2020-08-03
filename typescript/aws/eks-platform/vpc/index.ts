import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const vpc = new awsx.ec2.Vpc("lbriggs", {
    subnets: [
        { type: "public", tags: { "kubernetes.io/cluster/lbriggs": "shared", "kubernetes.io/role/elb": "1" } },
        { type: "private", tags: { "kubernetes.io/cluster/lbriggs": "shared", "kubernetes.io/role/internal-elb": "1" }  },
    ]
})

export const vpcId = vpc.id
export const privateSubnets = vpc.privateSubnetIds
export const publicSubnets = vpc.publicSubnetIds




