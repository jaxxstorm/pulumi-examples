import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";

const role = new aws.iam.Role("managed-nodegroup", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com"
    })
})

const managedPolicyArns: string[] = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
];

let counter = 0;
    for (const policy of managedPolicyArns) {
        // Create RolePolicyAttachment without returning it.
        const rpa = new aws.iam.RolePolicyAttachment(`managed-policy-${counter++}`,
            { policyArn: policy, role: role },
        );
    }

const cluster = new eks.Cluster("example-managed-nodegroups", {
    skipDefaultNodeGroup: true,
    deployDashboard: false,
    instanceRoles: [ role ]
});

// Export the cluster's kubeconfig.
export const kubeconfig = cluster.kubeconfig;

// Create a simple AWS managed node group using a cluster as input and the
// refactored API.
const managedNodeGroup = new eks.ManagedNodeGroup("nodegroup", {
    cluster: cluster,
    nodeRole: role,
});

let nodeGroup = aws.eks.getNodeGroupOutput({
    nodeGroupName: managedNodeGroup.nodeGroup.nodeGroupName,
    clusterName: cluster.eksCluster.name,
})

// export const nodegroupresource = nodeGroup.resources[0].autoscalingGroups[0].name


