import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const vpc = new awsx.ec2.Vpc(`redshift-vpc`, {
    cidrBlock: "172.16.0.0/24",
    tags: {
        Name: `redshift-vpc`,
        Owner: "lbriggs",
        owner: "lbriggs",
    }
});

const subnetGroup = new aws.redshift.SubnetGroup("example", {
    subnetIds: vpc.privateSubnetIds,
    tags: {
        Owner: "lbriggs",
        owner: "lbriggs",
    },
});

const securityGroup = new aws.ec2.SecurityGroup("lambda", {
    ingress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: [ "172.16.0.0/24" ] },
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
    vpcId: vpc.id,
})

const cluster = new aws.redshift.Cluster('example-cluster', {
    clusterIdentifier: 'example-cluster',
    clusterType: "multi-node",
    masterPassword: 'correct-Horse-battery-stab1e',
    masterUsername: 'administrator',
    nodeType: "ds2.xlarge",
    numberOfNodes: 2,
    publiclyAccessible: false,
    skipFinalSnapshot: true,
    enhancedVpcRouting: true,
    clusterSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [securityGroup.id],
});

export const nodes = cluster.clusterNodes
