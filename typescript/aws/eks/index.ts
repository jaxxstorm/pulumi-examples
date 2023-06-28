import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";

const name = "lbriggs-eks-example"
const awsConfig = new pulumi.Config("aws");
const profile = awsConfig.require("profile")

// Allocate a new VPC with custom settings, and a public & private subnet per AZ.
const vpc = new awsx.ec2.Vpc(`${name}-vpc`, {
    cidrBlock: "172.16.0.0/24",
    subnets: [
        {
            type: "private",
            tags: {
                "kubernetes.io/role/internal-elb": "1",
            }
        },
        {
            type: "public",
            tags: {
                "kubernetes.io/role/elb": "1",
            }
        }],
    tags: {
        Name: `${name}-vpc`,
        Owner: "lbriggs",
        owner: "lbriggs",
    }
});

const kubeconfigOpts: eks.KubeconfigOptions = {profileName: profile};

// define an EKS cluster
const cluster = new eks.Cluster(name, {
    providerCredentialOpts: kubeconfigOpts,
    vpcId: vpc.id,
    privateSubnetIds: vpc.privateSubnetIds,
    publicSubnetIds: vpc.publicSubnetIds,
    instanceType: "t2.medium",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 2,
    createOidcProvider: true,
    tags: {
        Owner: "lbriggs",
        owner: "lbriggs",
    }
});

// // define an IAM role that the nodegroups can use
// const nodegroupIAMRole = new aws.iam.Role(name, {assumeRolePolicy: JSON.stringify({
//     Statement: [{
//         Action: "sts:AssumeRole",
//         Effect: "Allow",
//         Principal: {
//             Service: "ec2.amazonaws.com",
//         },
//     }],
//     Version: "2012-10-17",
// })});


// const workerNodePolicy = new aws.iam.RolePolicyAttachment("workerNodePolicy", {
//     policyArn: "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
//     role: nodegroupIAMRole.name,
// });
// const cniNodePolicy = new aws.iam.RolePolicyAttachment("cniPolicy", {
//     policyArn: "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
//     role: nodegroupIAMRole.name,
// });
// const registryNodePolicy = new aws.iam.RolePolicyAttachment("example-registryPolicy", {
//     policyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
//     role: nodegroupIAMRole.name,
// });

// const taintedNodeGroup = new aws.eks.NodeGroup("tainted", {
//     clusterName: cluster.eksCluster.name,
//     nodeRoleArn: nodegroupIAMRole.arn,
//     subnetIds: vpc.privateSubnetIds,
//     scalingConfig: {
//         minSize: 1,
//         desiredSize: 3,
//         maxSize: 5
//     },
//     taints: [{
//         effect: "NO_SCHEDULE",
//         key: "dedicated",
//         value: "example",
//     }],
//     tags: {
//         "type": "tainted",
//     }
// })

// const spotNodeGroup = new aws.eks.NodeGroup("spot", {
//     clusterName: cluster.eksCluster.name,
//     nodeRoleArn: nodegroupIAMRole.arn,
//     subnetIds: vpc.privateSubnetIds,
//     scalingConfig: {
//         minSize: 1,
//         desiredSize: 3,
//         maxSize: 5
//     },
//     capacityType: "SPOT",
//     tags: {
//         "type": "spot",
//     }
// })

vpc.privateSubnetIds.then(id => id.forEach((id, index) => {
    new aws.ec2.Tag(`subnettag-${index}`, {
        key: cluster.eksCluster.name.apply(name => `kubernetes.io/cluster/${name}`),
        resourceId: id,
        value: "owned",
    }, { parent: cluster})
}))

export const vpcCidr = "172.16.0.0/24"
export const serviceCidr = cluster.eksCluster.kubernetesNetworkConfig.serviceIpv4Cidr
export const clusterName = cluster.eksCluster.name
export const oidcProvider = cluster.core.oidcProvider?.arn
export const oidcIssuer = cluster.core.oidcProvider?.url
export const kubeconfig = cluster.kubeconfig


