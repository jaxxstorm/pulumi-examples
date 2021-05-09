import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";

let config = new pulumi.Config()
const stack = pulumi.getStack()
const eks = new pulumi.StackReference(`jaxxstorm/eks.ts/${stack}`);

// const provider = new k8s.Provider("k8s", { kubeconfig: eks.getOutput("kubeconfig") });

const fileBeatConfig = {
    "metricbeat.modules": [
        {
            "module": "kubernetes",
            "metricsets": [
                "container",
                "node",
                "pod",
                "system",
                "volume",
            ],
            "period": "10s",
            host: "${NODE_NAME}",
            hosts: ["https://${NODE_NAME}:10251"],
            "ssl.verification_mode": "none"
        }
    ]
}

const ns = new k8s.core.v1.Namespace("metricbeat", {
    metadata: {
        name: "metricbeat",
    }
})


const metricbeat = new k8s.helm.v2.Chart("metricbeat",
    {
        namespace: ns.metadata.name,
        path: 'metricbeat',
        values: {
            metricbeatConfig: {
                'metricbeat.yml': JSON.stringify(fileBeatConfig),
            }
        },
        // The helm chart is using a deprecated apiVersion,
        // So let's transform it
        transformations: [
            (obj: any) => {
                if (obj.kind == "DaemonSet")  {
                    obj.spec.template.metadata.annotations.daemonsetconfig = Buffer.from(JSON.stringify(fileBeatConfig)).toString("base64");
                }
            },
        ],
    },
);
