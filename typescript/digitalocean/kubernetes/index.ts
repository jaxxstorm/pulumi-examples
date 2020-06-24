import * as digitalocean from "@pulumi/digitalocean";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const nodeCount = config.getNumber("nodeCount") || 1;

const cluster = new digitalocean.KubernetesCluster("do-cluster", {
  region: digitalocean.Regions.SFO2,
  version: digitalocean.getKubernetesVersions({versionPrefix: "1.16"}).then(p => p.latestVersion),
  nodePool: {
      name: "default",
      size: "s-1vcpu-2gb",
      nodeCount: nodeCount,
  },
});

// The DigitalOcean Kubernetes cluster periodically gets a new certificate,
// so we look up the cluster by name and get the current kubeconfig after
// initial provisioning. You'll notice that the `certificate-authority-data`
// field changes on every `pulumi update`.
export const kubeConfig = cluster.status.apply(status => {
  if (status === "running") {
      const clusterDataSource = cluster.name.apply(name => digitalocean.getKubernetesCluster({name}));
      return clusterDataSource.kubeConfigs[0].rawConfig;
  } else {
      return cluster.kubeConfigs[0].rawConfig;
  }
});


// configure a kubernetes provider
const provider = new k8s.Provider("k8s", { kubeconfig: kubeConfig })

const namespace = new k8s.core.v1.Namespace("ns", {
    metadata: {
        name: "nginx-ingress",
    }
}, { provider: provider });

// deploy nginx-ingress with helm
const nginx = new k8s.helm.v2.Chart("nginx-ingress",
    {
        namespace: namespace.metadata.name,
        chart: "nginx-ingress",
        version: "1.33.5",
        fetchOpts: { repo: "https://kubernetes-charts.storage.googleapis.com/" },
        values: {
            controller: {
                replicaCount: 1,
                service: {
                    type: "LoadBalancer",
                },
                publishService: {
                    enabled: true,
                },
            },
        }
    },
    { providers: { kubernetes: provider } },
)
