import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as k8s from "@pulumi/kubernetes";

const vpc = awsx.ec2.Vpc.getDefault();

const role = new aws.iam.Role("eks", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "eks.amazonaws.com" }),
})

new aws.iam.RolePolicyAttachment("eks-service-policy", {
    role: role.id,
    policyArn: "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
})

new aws.iam.RolePolicyAttachment("eks-cluster-policy", {
    role: role.id,
    policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
})

const cluster = new aws.eks.Cluster("eks", {
    roleArn: role.arn,
    vpcConfig: {
        publicAccessCidrs: [ "0.0.0.0/0" ],
        subnetIds: vpc.publicSubnetIds, 
    }
})

const auth = cluster.endpoint.apply(endpoint => 
    new k8s.core.v1.ConfigMap("aws-auth", {
        metadata: {
            name: "aws-auth"
        }
    }))


