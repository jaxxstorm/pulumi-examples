"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws
import pulumi_eks as eks
import pulumi_kubernetes as k8s

import pulumi_crds as app
# import application.pulumi_crds as app
# from application.pulumi_crds import argoproj
# from application.pulumi_crds.argoproj import v1alpha1

# get the default VPCs to deploy the cl
vpc = aws.ec2.get_vpc(default=True)
subnets = aws.ec2.get_subnet_ids(vpc_id=vpc.id)

# create a simple EKS cluster
cluster = eks.Cluster("argo-example")

# define an namespace for the argocd deployment to live in
provider = k8s.Provider(
    "eks",
    kubeconfig=cluster.kubeconfig
)

ns = k8s.core.v1.Namespace(
    'argocd',
    metadata={
        "name": "argocd",
    },
    opts=pulumi.ResourceOptions(
        provider=provider
    )
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
    opts=pulumi.ResourceOptions(provider=provider, parent=ns),
)

# # define a namespace to deploy our app to.
app_ns = k8s.core.v1.Namespace(
    "sock-shop",
    metadata={
        "name": "sock-shop",
    },
    opts=pulumi.ResourceOptions(provider=provider, parent=cluster),
)

# # FIXME: make this a component
argo_app = app.argoproj.v1alpha1.Application(
    "sock-shop",
    metadata=k8s.meta.v1.ObjectMetaArgs(name="sock-shop", namespace=ns.metadata.name),
    spec=app.argoproj.v1alpha1.ApplicationSpecArgs(
        destination=app.argoproj.v1alpha1.ApplicationSpecDestinationArgs(
            namespace=app_ns.metadata.name,
            server="https://kubernetes.default.svc"
        ),
        project="default",
        source=app.argoproj.v1alpha1.ApplicationSpecSourceArgs(
            path="sock-shop",
            repo_url="https://github.com/argoproj/argocd-example-apps",
            target_revision="HEAD",
        ),
        sync_policy=app.argoproj.v1alpha1.ApplicationSpecSyncPolicyArgs(
            automated={}
        )
    ),
    opts=pulumi.ResourceOptions(provider=provider, depends_on=[argo, app_ns]),
)

pulumi.export("kubeconfig", cluster.kubeconfig)
