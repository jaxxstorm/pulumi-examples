import * as k8s from "@pulumi/kubernetes";

const deployment = new k8s.yaml.ConfigFile("deployment", {
  file: "deployment.yaml",
  transformations: [
      (obj: any) => {
          obj.spec.template.spec.containers
              .find((container: any) => container.name === "postgres")
              .env
              .find((env: any) => env.name === "POSTGRES_DB")
              .value = "changed_by_transformation";
          obj.spec.template.spec.containers
              .find((container: any) => container.name === "postgres")
              .env
              .find((env: any) => env.name === "POSTGRES_USER")
              .value = "changed_by_transformation";
      },
  ],
}, { del});