"""An AWS Python Pulumi program"""

import pulumi
from pulumi.resource import ResourceOptions
import pulumi_aws as aws
from pulumi_aws import provider
import pulumi_eks as eks
import pulumi_kubernetes as k8s

# get the default VPCs to deploy the cl
vpc = aws.ec2.get_vpc(default=True)
subnets = aws.ec2.get_subnet_ids(vpc_id=vpc.id)

# create a simple EKS cluster
cluster = eks.Cluster("argo-example")

# define an namespace for the argocd deployment to live in
ns = k8s.core.v1.Namespace(
    "argocd",
    metadata={
        "name": "argocd",
    },
    opts=pulumi.ResourceOptions(provider=cluster.provider, parent=cluster, aliases=[pulumi.Alias(name='ns')]),
)

# we use helm release because the chart contains several hooks
argo = k8s.helm.v3.Release(
    "argocd",
    args=k8s.helm.v3.ReleaseArgs(
        chart="argo-cd",
        namespace=ns.metadata.name,
        repository_opts=k8s.helm.v3.RepositoryOptsArgs(
            repo="https://argoproj.github.io/argo-helm"
        ),
        values={
            "server": {
                "service": {
                    "type": "LoadBalancer",
                }
            }
        },
    ),
    opts=pulumi.ResourceOptions(provider=cluster.provider, parent=ns),
)

# define a namespace to deploy our app to.
app_ns = k8s.core.v1.Namespace(
    "sock-shop",
    metadata={
        "name": "sock-shop",
    },
    opts=pulumi.ResourceOptions(provider=cluster.provider, parent=cluster),
)

# deploy the argo app as a custom resource
# FIXME: make this a component
argo_app = k8s.apiextensions.CustomResource(
    "sock-shop",
    api_version="argoproj.io/v1alpha1",
    kind="Application",
    metadata=k8s.meta.v1.ObjectMetaArgs(
        name="sock-shop",
        namespace=ns.metadata.name,
    ),
    spec={
        "destination": {
            "namespace": app_ns.metadata.name,
            "server": "https://kubernetes.default.svc",
        },
        "project": "default",
        "source": {
            "path": "sock-shop",
            "repoURL": "https://github.com/argoproj/argocd-example-apps",
            "targetRevision": "HEAD",
        },
        "syncPolicy": {"automated": {}},
    },
    opts=pulumi.ResourceOptions(provider=cluster.provider, depends_on=[argo, app_ns]),
)

pulumi.export("kubeconfig", cluster.kubeconfig)
