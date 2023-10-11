"""A DigitalOcean Python Pulumi program"""

import pulumi
import pulumi_kubernetes as k8s
import pulumi_digitalocean as do
import pulumi_kubernetes.helm.v3 as helm
import time
import kubernetes as kube
import yaml

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
    opts=pulumi.ResourceOptions(provider=provider),
)


def wait_for_loadbalancer(
    kubeconfig: str,
    name: str,
    namespace: str,
    status: k8s.core.v1.outputs.ServiceStatus,
):
    if not pulumi.runtime.is_dry_run():
        k = yaml.safe_load(kubeconfig)
        kube.config.load_kube_config_from_dict(config_dict=k)
        api_instance = kube.client.CoreV1Api()
        for i in range(60):
            service_details = api_instance.read_namespaced_service(
                name=name, namespace=namespace
            )
            print("outside try")
            try:
                print("inside try")
                ip = service_details.status.loadBalancer.ingress[0].ip
                if ip:
                    pulumi.log.info(f"Service IP found: {ip}")
                    return ip
            except:
                print("inside except")
                pass

            pulumi.log.info(f"Waiting for Service IP ({i})", name)
            time.sleep(10)
        
        raise Exception("timed out waiting for Service IP to be available")
        
        


pulumi.Output.all(
    kubeconfig=kubeconfig, namespace=srv.metadata['namespace'], name=srv.metadata["name"], status=srv.status
).apply(
    lambda args: wait_for_loadbalancer(
        args["kubeconfig"], args["name"], args["namespace"], args["status"]
    )
)
