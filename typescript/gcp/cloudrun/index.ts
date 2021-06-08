import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as docker from "@pulumi/docker";

const imageName = "my-first-gcp-app";
const image = new docker.Image("example", {
  imageName: pulumi.interpolate`gcr.io/${gcp.config.project}/${imageName}:latest`,
  build: {
    context: "./wwwroot",
  },
});

const container = new gcp.cloudrun.Service("temp-app", {
  name: "temp-app",
  location: "us-central1",
  template: {
    spec: {
      containers: [
        {
          image: image.imageName,
          ports: [{
            containerPort: 80,
          }],
          resources: {
            requests: {
              memory: "64Mi",
              cpu: "200m",
            },
            limits: {
              memory: "256Mi",
              cpu: "1000m",
            },
          },
        },
      ],
      containerConcurrency: 80,
    },
  },
});

// Open the service to public unrestricted access
const iam = new gcp.cloudrun.IamMember("example", {
    service: container.name,
    location: "us-central1",
    role: "roles/run.invoker",
    member: "allUsers",
});

// Export the URL
export const url = container.statuses[0].url
