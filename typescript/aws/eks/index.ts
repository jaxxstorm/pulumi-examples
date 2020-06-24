import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Allocate a new VPC with custom settings, and a public & private subnet per AZ.
const vpc = new awsx.ec2.Vpc(`lbriggs`, {
    cidrBlock: "172.16.0.0/16",
    subnets: [{ type: "public" }, { type: "private" }],
});

// export the VPC id in case we want to use it any other stakc
export const vpcId = vpc.id;

// create an IAM role for the clster
const clusterRole = new aws.iam.Role(`lbriggs`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
    }),
});

// Set some polict attachments that EKS needs to work properly
const managedPolicyArns: string[] = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
];
let counter = 0;
for (const policy of managedPolicyArns) {
    // Create RolePolicyAttachment without returning it.
    const rpa = new aws.iam.RolePolicyAttachment(`lbriggs-policy-${counter++}`,
        { policyArn: policy, role: clusterRole },
    );
}

// Create a new EKS cluster!
const cluster = new aws.eks.Cluster(`lbriggs`, {
    vpcConfig: {
        subnetIds: vpc.privateSubnetIds,
        vpcId: vpc.id
    },
    roleArn: clusterRole.id
})

/*
// We want to modify the default security group, so add a securityGroup rule
const defaultEgress = new aws.ec2.SecurityGroupRule(`egress-default`, {
    description: "Outbound everything",
    type: "egress",
    fromPort: 0,
    toPort: 0,
    protocol: "-1", // all
    // We need to use apply here to get the raw property of the output
    securityGroupId: cluster.vpcConfig.apply(
        sg => sg.clusterSecurityGroupId
    ),
    self: true,
})
*/



