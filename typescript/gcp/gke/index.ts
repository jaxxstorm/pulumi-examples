import * as pulumi from "@pulumi/pulumi";
import * as gcloud from "@pulumi/google-native";
import { project, region } from "./config";

const cluster = new gcloud.container.v1.Cluster("cluster", {
  project: project,
  location: region,
  parent: `projects/${project}/locations/${region}`,
  initialClusterVersion: "1.21.6-gke.1500",
  network: `projects/${project}/global/networks/default`,
  nodePools: [
    {
      name: "default",
      initialNodeCount: 5,
    },
  ],
});

export const kubeConfig = pulumi
  .all([cluster.name, cluster.endpoint, cluster.location, cluster.masterAuth])
  .apply(([name, endpoint, location, auth]) => {
    const context = `${project}_${location}_${name}`;
    return JSON.stringify({
      apiVersion: "v1",
      clusters: [
        {
          cluster: {
            "certificate-authority-data": auth.clusterCaCertificate,
            "server": `https://${endpoint}`,
          },
          name: context,
        },
      ],
      contexts: [
        {
          context: {
            cluster: context,
            user: context,
          },
          name: context,
        },
      ],
      "current-context": context,
      kind: "Config",
      preferences: {},
      users: [
        {
          name: context,
          user: {
            "auth-provider": {
              config: {
                "cmd-args": "config config-helper --format=json",
                "cmd-path": "gcloud",
                "expiry-key": '{.credential.token_expiry}',
                "token-key": '{.credential.access_token}',
              },
              name: "gcp",
            },
          },
        },
      ],
    });
  });
