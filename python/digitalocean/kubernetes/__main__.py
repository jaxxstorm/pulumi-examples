"""A DigitalOcean Python Pulumi program"""

import pulumi
import pulumi_kubernetes as k8s
import pulumi_digitalocean as do
import pulumi_kubernetes.helm.v3 as helm
import time

config = pulumi.Config()
node_count = config.get_float("nodeCount") or 1


version = do.get_kubernetes_versions()

cluster = do.KubernetesCluster(
    "cluster",
    auto_upgrade=True,
    version=version.latest_version,
    region="sfo2",
    node_pool=do.KubernetesClusterNodePoolArgs(
        name="default",
        size="s-1vcpu-2gb",
        node_count=3,
    ),
)

kubeconfig = cluster.kube_configs[0].raw_config

pulumi.export("kubeconfig", kubeconfig)

provider = k8s.Provider(
    "provider",
    kubeconfig=kubeconfig,
)

ns = k8s.core.v1.Namespace(
    "nginx-ingress",
    metadata=k8s.meta.v1.ObjectMetaArgs(
        name="nginx-ing",
    ),
    opts=pulumi.ResourceOptions(provider=provider),
)

# We're going to install the nginx-ingress controller here
# if we leave `skip_await` to False, the release will wait for the loadbalancer to return
# its IP anyway
# however, we're going to use the `skip_await` option to show how else it can be done

ingress = k8s.helm.v3.Release(
    "nginx-ing",
    args=k8s.helm.v3.ReleaseArgs(
        chart="ingress-nginx",
        namespace=ns.metadata.name,
        skip_await=True,  # If you leave this as false, helm will wait until the lb is healthy anyway
        repository_opts=k8s.helm.v3.RepositoryOptsArgs(
            repo="https://kubernetes.github.io/ingress-nginx"
        ),
        values={
            "controller": {
                "publishService": {
                    "enabled": True,
                },
            }
        },
    ),
    opts=pulumi.ResourceOptions(provider=provider, parent=ns),
)

# okay, retrieve the loadbalancer
srv = k8s.core.v1.Service.get(
    "loadbalancer",
    pulumi.Output.concat(
        ingress.status.namespace, "/", ingress.status.name, "-ingress-nginx-controller"
    ),
)

def wait_for_loadbalancer(status):
    try:
        ip = status.loadBalancer.ingress[0].ip
        if ip:
            pulumi.log.info(f"Loadbalancer has provisioned: {ip}", ephemeral=False)
            return ip
    except:
        pulumi.log.warn("Waiting for loadbalancer to return IP address", ephemeral=True)

    # If the IP hasn't propagated, sleep for a short duration and then check again
    time.sleep(10)
    return wait_for_loadbalancer(status)

ip_address = srv.status.apply(wait_for_loadbalancer)
