"""A DigitalOcean Python Pulumi program"""

import pulumi
import pulumi_kubernetes as k8s
import pulumi_digitalocean as do
import pulumi_kubernetes.helm.v3 as helm
from pulumi_kubernetes.core.v1 import Namespace

config = pulumi.Config()
node_count = config.get_float("nodeCount") or 1


# Create a Kubernetes Cluster in DigitalOcean
cluster = do.KubernetesCluster(
    "do-cluster",
    region="sfo2",
    version="1.16",
    node_pool={
        "name": "default",
        "size": "s-1vcpu-2gb",
        "nodeCount": node_count
    }

)

# Use the Kubeconfig output to create a k8s provider
k8s_provider = k8s.Provider("k8s", kubeconfig=cluster.kube_configs[0]["rawConfig"])

# Create a namespace using the previous retrieved kubernetes provider
namespace = Namespace(
    "ns",
    metadata={
        "name": "nginx-ingress"
    }, opts=pulumi.ResourceOptions(provider=k8s_provider))

chart = helm.Chart(
    "nginx-ingress",
    helm.ChartOpts(namespace="nginx-ingress",
    chart="nginx-ingress",
    version="1.33.5",
    fetch_opts=k8s.helm.v3.FetchOpts(
        repo="https://kubernetes-charts.storage.googleapis.com/"
    ),
    values={
        "controller": {
            "replicaCount": 1,
            "service": {
                "type": "LoadBalancer"
            },
            "publishService": {
                "enabled": True,
            }
        }
    }), pulumi.ResourceOptions(provider=k8s_provider)
)

