import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

const ns = new k8s.core.v1.Namespace("istio", {
  metadata: {
    name: "istio-system",
  },
});

const base = new k8s.helm.v3.Release(
  "istio-base",
  {
    chart: "base",
    namespace: ns.metadata.name,
    repositoryOpts: {
      repo: "https://istio-release.storage.googleapis.com/charts",
    },
  },
  { parent: ns }
);

const istiod = new k8s.helm.v3.Release(
  "istiod",
  {
    chart: "istiod",
    namespace: ns.metadata.name,
    repositoryOpts: {
      repo: "https://istio-release.storage.googleapis.com/charts",
    },
  },
  { parent: ns }
);

const gatewayns = new k8s.core.v1.Namespace("istio-ingress", {
  metadata: {
    name: "istio-ingress",
    labels: {
      "istio-injection": "enabled",
    },
  },
}, { dependsOn: istiod});

const gateway = new k8s.helm.v3.Release(
  "gateway",
  {
    chart: "gateway",
    namespace: gatewayns.metadata.name,
    repositoryOpts: {
      repo: "https://istio-release.storage.googleapis.com/charts",
    },
    values: {
      labels: {
        "istio": "ingressgateway"
      }
    }
  },
  { parent: gatewayns }
);

const lbSvc = k8s.core.v1.Service.get("gateway-svc", 
  pulumi.interpolate`${gateway.status.namespace}/${gateway.status.name}`)

export const lb = lbSvc.status.loadBalancer.ingress[0].hostname
