import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

const cluster = new digitalocean.KubernetesCluster("do-cluster", {
  region: digitalocean.Regions.SFO2,
  version: digitalocean.getKubernetesVersions({versionPrefix: "1.16"}).then(p => p.latestVersion),  
  nodePool: {
    name: "default",
    size: digitalocean.DropletSlugs.DropletS2VCPU2GB,
    nodeCount: 3,
  },
});
