import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";

let secret = [
  {
    url: "example.com",
    basic_auth: {
      username: "user",
      password: "XXX",
    },
  },
];

const databaseSecret = new k8s.core.v1.Secret("secret-config", {
  data: {
    remote_write: Buffer.from(JSON.stringify(secret), 'binary').toString('base64'),
  },
});

const databaseSecret = new k8s.core.v1.Secret("secret-config", {
    data: {
      remote_write: JSON.stringify(secret),
    },
  });
