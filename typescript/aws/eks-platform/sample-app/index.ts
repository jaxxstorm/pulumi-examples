import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

let config = new pulumi.Config()
const stack = pulumi.getStack()
const eks = new pulumi.StackReference(`jaxxstorm/eks.ts/${stack}`);

const provider = new k8s.Provider("k8s", {kubeconfig: eks.getOutput("kubeconfig")});

// Create a namespace to deploy sock-shop
const ns = new k8s.core.v1.Namespace("sock-shop", {
    metadata: {
        name: "sock-shop",
    }
}, {provider: provider});

// Registers an Argo Application in the Kubernetes APO
const sockshop = new k8s.apiextensions.CustomResource(
    "sock-shop",
    {
        apiVersion: "argoproj.io/v1alpha1",
        kind: "Application",
        metadata: {
            namespace: "default", // the ns where argocd is deployed
            name: "sock-shop", // name of app in ArgoCd
        },
        spec: {
            destination: {
                namespace: ns.metadata.name,
                server: "https://kubernetes.default.svc",
            },
            project: "default",
            source: {
                path: "sock-shop",
                repoURL: "https://github.com/argoproj/argocd-example-apps",
                targetRevision: "HEAD",
            },
            syncPolicy: {
                automated: {}
            }
        }
    },
    {provider: provider, parent: ns}
);

export const url = k8s.core.v1.Service.get("frontend", "sock-shop/front-end", {provider: provider}).status.loadBalancer.ingress[0].hostname

// TODO: get the load balancer from the service url, essentially kubectl get svc

