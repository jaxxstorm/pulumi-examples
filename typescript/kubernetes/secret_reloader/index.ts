import * as k8s from "@pulumi/kubernetes";

const ns = new k8s.core.v1.Namespace("mysql", {
    metadata: {
        name: "mysql"
    }
})


const password = "correct-horse-battery-stable-1"
/*
 * We define the secret explicitly
 * then we use replaceOnChanges to ensure it changes and regens a new name
 */
const mysqlPassword = new k8s.core.v1.Secret("auth", {
    metadata: {
        namespace: ns.metadata.name
    },
    stringData: {
        "mysql-root-password": password,
        "mysql-replication-password": password,
        "mysql-password": password
    }
}, { replaceOnChanges: [ "stringData" ], parent: ns } )

const mysql = new k8s.helm.v3.Release(
    "mysql",
    {
      chart: "mysql",
      namespace: ns.metadata.name,
      repositoryOpts: {
        repo: "https://charts.bitnami.com/bitnami",
      },
      values: {
          auth: {
            existingSecret: mysqlPassword.metadata.name
          }
      }
    },
    { parent: ns }
  );
