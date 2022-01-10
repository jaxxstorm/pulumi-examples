import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface IstioDeploymentEnvArgs {
  name: string;
  value: pulumi.Output<string> | string;
}

export interface IstioDeploymentArgs {
  image: string;
  namespace: pulumi.Output<string>;
  version?: string;
  port: number;
  extraEnv: IstioDeploymentEnvArgs[];
  appLabel?: string;
}
export interface IstioDeploymentServiceArgs {
  namespace: pulumi.Output<string>;
  port: number;
}

export class IstioDeployment extends pulumi.ComponentResource {
  deployment: k8s.apps.v1.Deployment;
  serviceAccount: k8s.core.v1.ServiceAccount;
  env: IstioDeploymentEnvArgs[] = [{ name: "LOG_DIR", value: "/tmp/logs" }];

  private readonly name: string;

  constructor(
    name: string,
    args: IstioDeploymentArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:IstioDeployment", name, {}, opts);

    this.name = name;

    for (var e of args.extraEnv) {
      this.env.push(e);
    }

    this.serviceAccount = new k8s.core.v1.ServiceAccount(
      name,
      {
        metadata: {
          labels: {
            account: name,
            app: args.appLabel || name,
          },
          namespace: args.namespace,
        },
      },
      { parent: this }
    );

    this.deployment = new k8s.apps.v1.Deployment(
      name,
      {
        metadata: {
          labels: {
            app: args.appLabel || name,
            name: name,
            version: args.version || "v1",
          },
          namespace: args.namespace,
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: args.appLabel || name,
              name: name,
              version: args.version || "v1",
            },
          },
          template: {
            metadata: {
              labels: {
                app: args.appLabel || name,
                name: name,
                version: args.version || "v1",
              },
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              containers: [
                {
                  name: name,
                  image: args.image,
                  imagePullPolicy: "IfNotPresent",
                  env: this.env,
                  ports: [
                    {
                      containerPort: args.port,
                    },
                  ],
                  volumeMounts: [
                    {
                      name: "tmp",
                      mountPath: "/tmp",
                    },
                    {
                      name: "wlp-output",
                      mountPath: "/opt/ibm/wlp/output",
                    },
                  ],
                  securityContext: {
                    runAsUser: 1000,
                  },
                },
              ],
              volumes: [
                {
                  name: "wlp-output",
                  emptyDir: {},
                },
                {
                  name: "tmp",
                  emptyDir: {},
                },
              ],
            },
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({});
  }

  public createService(
    name: string,
    args: IstioDeploymentServiceArgs
  ): k8s.core.v1.Service {
    const svc = new k8s.core.v1.Service(
      name,
      {
        metadata: {
          name: name,
          labels: {
            app: name,
            service: name,
          },
          namespace: args.namespace,
        },
        spec: {
          ports: [
            {
              port: args.port,
              name: "http",
            },
          ],
          selector: {
            app: name,
          },
        },
      },
      { parent: this }
    );
    return svc;
  }
}
