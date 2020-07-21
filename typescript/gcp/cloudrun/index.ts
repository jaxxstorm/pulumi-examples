import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const cloudRun = new gcp.projects.Service('cloudrun', {
    service: "run.googleapis.com"
})

export const container = new gcp.cloudrun.Service(
    "temp-app",
    {
        name: "temp-app",
        location: 'us-central1',
        template: {
            spec: {
                containers: [
                    {
                        image: 'gcr.io/cloudrun/hello',
                        resources: {
                            requests: {
                                memory: '64Mi',
                                cpu: '200m',
                            },
                            limits: {
                                memory: '256Mi',
                                cpu: '1000m',
                            },
                        },
                    },
                ],
                containerConcurrency: 80,
            },
        },
    }, { dependsOn: cloudRun })

