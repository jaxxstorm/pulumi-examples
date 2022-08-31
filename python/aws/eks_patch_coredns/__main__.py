"""An AWS Python Pulumi program"""

import json

import pulumi
import pulumi_eks as eks
import pulumi_aws as aws
import pulumi_kubernetes as k8s
import pulumi_awsx as awsx

# create an easy VPC with awsx
vpc = awsx.ec2.Vpc(
    "patch",
    cidr_block="172.1.0.0/22",
)

# create the node role that allows
# the node group to connect to the EKS control plane
node_role = aws.iam.Role(
    "patch-system-nodes",
    assume_role_policy=json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "AllowAssumeRole",
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ec2.amazonaws.com",
                    },
                    "Action": "sts:AssumeRole",
                }
            ],
        }
    ),
)

# required policies for the EKS node
required_policies = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
]

for i, policy in enumerate(required_policies):
    # Create RolePolicyAttachment without returning it.
    aws.iam.RolePolicyAttachment(
        f"patch-system-nodes-policy-{i}", policy_arn=policy, role=node_role.id
    )

# an instance profile
instance_profile = aws.iam.InstanceProfile(
    "patch-system-nodes",
    role=node_role,
)

# create an EKS cluster with a single default node group
cluster = eks.Cluster(
    "patch",
    vpc_id=vpc.vpc_id,
    provider_credential_opts=eks.KubeconfigOptionsArgs(
        profile_name="pulumi-dev-sandbox"
    ),
    private_subnet_ids=vpc.private_subnet_ids,
    public_subnet_ids=vpc.public_subnet_ids,
    instance_type="t2.medium",
    min_size=1,
    max_size=1,
    desired_capacity=1,
    create_oidc_provider=True,
    instance_role=node_role,
)

# create a provider from the kubeconfig
# enable server side apply for it
kube_provider = k8s.Provider(
    "patch",
    kubeconfig=cluster.kubeconfig,
    enable_server_side_apply=True,
)

# create a special, dedicated system node group
system_nodes = eks.NodeGroup(
    "patch-system-nodes",
    cluster=cluster.core,
    instance_type="t2.medium",
    min_size=1,
    max_size=1,
    desired_capacity=1,
    node_subnet_ids=vpc.private_subnet_ids,
    taints={"system": {"value": "true", "effect": "NoSchedule"}}, # noqa note the taints
    instance_profile=instance_profile,
    opts=pulumi.ResourceOptions(provider=kube_provider), # noqa we need the kube provider for the daemonset
)

# export the kubeconfig so we can examine it
pulumi.export("kubeconfig", cluster.kubeconfig)

# now let's patch CoreDNS to run on our special nodes
coredns = k8s.apps.v1.Deployment(
    "coredns",
    metadata=k8s.meta.v1.ObjectMetaPatchArgs(
        name="coredns",
        namespace="kube-system",
        annotations={
            "pulumi.com/patchForce": "true", # noqa # do not omit this, it's important
        },
    ),
    spec=k8s.apps.v1.DeploymentSpecPatchArgs(
        template=k8s.core.v1.PodTemplateSpecPatchArgs(
            spec=k8s.core.v1.PodSpecPatchArgs(
                tolerations=[
                    k8s.core.v1.TolerationPatchArgs(
                        key="system",
                        value="true",
                        effect="NoSchedule",
                    )
                ]
            )
        )
    ),
    opts=pulumi.ResourceOptions(provider=kube_provider),
)
