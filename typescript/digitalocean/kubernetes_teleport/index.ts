import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import * as k8s from "@pulumi/kubernetes";
import * as cloudflare from "@pulumi/cloudflare";

const cluster = new digitalocean.KubernetesCluster("teleport", {
  version: "1.24.4-do.0",
  region: "sfo2",
  nodePool: {
    name: "system",
    size: "s-2vcpu-2gb",
    nodeCount: 1,
  },
});

export const kubeconfig = cluster.kubeConfigs[0].rawConfig

const provider = new k8s.Provider("teleport", {
    kubeconfig: kubeconfig,
})

const ns = new k8s.core.v1.Namespace("teleport", {
    metadata: {
        name: "teleport"
    }
}, { provider: provider, parent: provider })

const teleport = new k8s.helm.v3.Release("teleport", {
    chart: "teleport-cluster",
    namespace: ns.metadata.name,
    repositoryOpts: {
        repo: "https://charts.releases.teleport.dev"
    },
    values: {
        clusterName: "teleport.lbrlabs.com",
        acme: true,
        acmeEmail: "teleport@lbrlabs.com",
    },
    skipAwait: true,
}, { provider: provider, parent: ns })

const teleportAddress = k8s.core.v1.Service.get("teleport", pulumi.interpolate`${teleport.status.namespace}/${teleport.status.name}`, { provider: provider});

export const address = teleportAddress.status.loadBalancer.ingress[0].ip

const zone = cloudflare.getZoneOutput({
    name: "lbrlabs.com"
})

const record = new cloudflare.Record("teleport", {
    zoneId: zone.id,
    name: "teleport",
    value: address,
    type: "A",
    ttl: 1,
    proxied: false,
})

