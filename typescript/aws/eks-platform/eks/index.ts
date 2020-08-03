import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";

let config = new pulumi.Config()
const stack = pulumi.getStack()
const vpc = new pulumi.StackReference(`jaxxstorm/vpc.ts/${stack}`);
const vpcId = vpc.getOutput("vpcId")
const privateSubnets = vpc.getOutput("privateSubnets")
const publicSubnets = vpc.getOutput("publicSubnets")

const cluster = new eks.Cluster("lbriggs", {
    name: "lbriggs",
    vpcId: vpcId,
    privateSubnetIds: privateSubnets,
    publicSubnetIds: publicSubnets,
    createOidcProvider: true,
})

export const clusterName = cluster.eksCluster.name
export const kubeconfig = cluster.kubeconfig
export const clusterOidcProvider = cluster.core.oidcProvider?.url
export const clusterOidcProviderArn = cluster.core.oidcProvider?.arn
