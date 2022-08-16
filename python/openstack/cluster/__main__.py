"""A Python Pulumi program"""

import pulumi
import pulumi_openstack as openstack
import pulumi_kubernetes as k8s

config = pulumi.Config()
public_key = config.require("public_key")

# define a public key for the compute
keypair = openstack.compute.Keypair("lbriggs", public_key=public_key)

template = openstack.containerinfra.ClusterTemplate(
    "lbriggs",
    cluster_distro="fedora-coreos",
    coe="kubernetes",
    dns_nameserver="8.8.8.8",
    docker_storage_driver="overlay2",
    docker_volume_size=50,
    external_network_id="0048fce6-c715-4106-a810-473620326cb0",  # FIXME: define as a resource
    flavor="v3-standard-1",
    floating_ip_enabled=True,
    image="fedora-coreos-32.20200601.3.0-openstack.x86_64",  # FIXME: datasource
    keypair_id=keypair.name,
    master_flavor="v3-standard-1",
    name="lbriggs",
    network_driver="calico",
    public=True,
    server_type="vm",
    volume_driver="cinder",
)

cluster = openstack.containerinfra.Cluster(
    "lbriggs",
    cluster_template_id=template.id,
    create_timeout=60,
    docker_volume_size=50,
    flavor="v3-standard-1",
    floating_ip_enabled=True,
    keypair=keypair.name,
    labels={
        "availability_zone": "nova",
    },
    master_count=1,
    master_flavor="v3-starter-1",
    name="lbriggs",
    node_count=1,
)

pulumi.export("kubeconfig", cluster.kubeconfig)

kubernetes_provider = k8s.Provider(
    "cluster", kubeconfig=cluster.kubeconfig["raw_config"]
)

autoscaler = k8s.helm.v3.Release(
    "autoscaler",
    args=k8s.helm.v3.ReleaseArgs(
        chart="cluster-autoscaler",
        namespace="kube-system",
        repository_opts=k8s.helm.v3.RepositoryOptsArgs(
            repo="https://kubernetes.github.io/autoscaler"
        ),
        values={
            "cloudProvider": "magnum",
            "magnumClusterName": cluster.name,
            "autoscalingGroups": [{
                "name": "default-worker",
                "maxSize": 5,
                "minSize": 1
            }],
            "image": {
                "repository": "docker.io/openstackmagnum/cluster-autoscaler",
                "tag": "v1.23.0"
            },
            "cloudConfigPath": "/etc/kubernetes/cloud-config",
            "nodeSelector": {
                "node-role.kubernetes.io/master": "",
            },
            "tolerations": [
                {
                    "effect": "NoSchedule",
                    "operator": "Exists",
                },
                {
                    "key": "CriticalAddonsOnly",
                    "operator": "Exists",
                },
                {
                    "effect": "NoExecute",
                    "operator": "Exists"
                },
                {
                    "effect": "NoSchedule",
                    "key": "node.cloudprovider.kubernetes.io/uninitialized",
                    "value": "true"
                },
                {
                    "effect": "NoSchedule",
                    "key": "node-role.kubernetes.io/master"
                }
            ]
        },
    ),
    opts=pulumi.ResourceOptions(provider=kubernetes_provider)
)
