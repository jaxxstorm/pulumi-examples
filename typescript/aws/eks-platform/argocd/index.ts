import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";
import * as bcrypt from "bcryptjs";

let config = new pulumi.Config()
const stack = pulumi.getStack()
const eks = new pulumi.StackReference(`jaxxstorm/eks.ts/${stack}`);

const provider = new k8s.Provider("k8s", { kubeconfig: eks.getOutput("kubeconfig") });

// TODO: make this a secret and set as a config value
const password = bcrypt.hashSync("changeme", 10)

const argocd = new k8s.helm.v2.Chart("argocd",
    {
        namespace: "default",
        chart: "argo-cd",
        fetchOpts: { repo: "https://argoproj.github.io/argo-helm" },
        values: {
            installCRDs: false,
            configs: {
                secret: {
                    argocdServerAdminPassword: password,
                },
            },
            server: {
                service: {
                    type: 'LoadBalancer',
                },
            }
        },
        // The helm chart is using a deprecated apiVersion,
        // So let's transform it
        transformations: [
            (obj: any) => {
                if (obj.apiVersion == "extensions/v1beta1")  {
                    obj.apiVersion = "networking.k8s.io/v1beta1"
                }
            },
        ],
    },
    { providers: { kubernetes: provider }},
);

export const url = argocd.getResourceProperty("v1/Service", "default/argocd-server", "status").apply((status => status.loadBalancer.ingress[0].hostname))


// export const url = server.apply(status => status.loadBalancer.ingress[0].hostname)
