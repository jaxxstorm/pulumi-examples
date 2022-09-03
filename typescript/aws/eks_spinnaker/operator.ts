import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface SpinnakerOperatorArgs {
  version?: string;
}

export class SpinnakerOperator extends pulumi.ComponentResource {
  namespace: kubernetes.core.v1.Namespace;
  deployment: kubernetes.apps.v1.Deployment;
  serviceAccount: kubernetes.core.v1.ServiceAccount;
  role: kubernetes.rbac.v1.Role;
  roleBinding: kubernetes.rbac.v1.RoleBinding;

  constructor(
    name: string,
    args: SpinnakerOperatorArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:spinnakerOperator", name, {}, opts);

    let imageName = "armory/halyard";
    let version = args.version || "1.2.5-ubi";

    this.namespace = new kubernetes.core.v1.Namespace(
      name,
      {
        metadata: {
          name: name,
          labels: {
            name: "spinnaker-operator",
            instance: name,
          },
        },
      },
      { parent: this }
    );

    this.serviceAccount = new kubernetes.core.v1.ServiceAccount(
      name,
      {
        metadata: {
          namespace: this.namespace.metadata.name,
          labels: {
            name: "spinnaker-operator",
            instance: name,
          },
        },
      },
      { parent: this.namespace }
    );

    this.role = new kubernetes.rbac.v1.Role(name, {
      metadata: {
          name: name,
          namespace: this.namespace.metadata.name,
      },
      rules: [
          {
              apiGroups: [""],
              resources: [
                  "pods",
                  "services",
                  "endpoints",
                  "persistentvolumeclaims",
                  "events",
                  "configmaps",
                  "secrets",
                  "namespaces",
              ],
              verbs: ["*"],
          },
          {
              apiGroups: [
                  "batch",
                  "extensions",
              ],
              resources: ["jobs"],
              verbs: ["*"],
          },
          {
              apiGroups: [
                  "apps",
                  "extensions",
              ],
              resources: [
                  "deployments",
                  "daemonsets",
                  "replicasets",
                  "statefulsets",
              ],
              verbs: ["*"],
          },
          {
              apiGroups: ["monitoring.coreos.com"],
              resources: ["servicemonitors"],
              verbs: [
                  "get",
                  "create",
              ],
          },
          {
              apiGroups: ["apps"],
              resourceNames: ["spinnaker-operator"],
              resources: ["deployments/finalizers"],
              verbs: ["update"],
          },
          {
              apiGroups: ["spinnaker.io"],
              resources: [
                  "*",
                  "spinnakerservices",
              ],
              verbs: ["*"],
          },
          {
              apiGroups: [
                  "networking.k8s.io",
                  "extensions",
              ],
              resources: ["ingresses"],
              verbs: [
                  "get",
                  "list",
                  "watch",
              ],
          },
      ],
  }, { parent: this.namespace });


    this.roleBinding = new kubernetes.rbac.v1.RoleBinding(
      name,
      {
        metadata: {
          namespace: this.namespace.metadata.name,
          labels: {
            name: "spinnaker-operator",
            instance: name,
          },
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: this.serviceAccount.metadata.name,
            namespace: this.namespace.metadata.name,
          },
        ],
        roleRef: {
          kind: "Role",
          name: this.role.metadata.name,
          apiGroup: "rbac.authorization.k8s.io",
        },
      },
      { parent: this.namespace }
    );

    this.deployment = new kubernetes.apps.v1.Deployment(
      name,
      {
        metadata: {
          namespace: this.namespace.metadata.name,
          labels: {
            name: "spinnaker-operator",
            instance: name,
          },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              name: "spinnaker-operator",
              instance: name,
            },
          },
          template: {
            metadata: {
              labels: {
                name: "spinnaker-operator",
                instance: name,
              },
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              containers: [
                {
                  name: "spinnaker-operator",
                  image: "armory/spinnaker-operator:dev",
                  command: ["spinnaker-operator"],
                  args: ["--disable-admission-controller"],
                  imagePullPolicy: "Always",
                  env: [
                    {
                      name: "WATCH_NAMESPACE",
                      valueFrom: {
                        fieldRef: {
                          fieldPath: "metadata.namespace",
                        },
                      },
                    },
                    {
                      name: "POD_NAME",
                      valueFrom: {
                        fieldRef: {
                          fieldPath: "metadata.name",
                        },
                      },
                    },
                    {
                      name: "OPERATOR_NAME",
                      value: "spinnaker-operator",
                    },
                  ],
                },
                {
                  name: "halyard",
                  image: "armory/halyard:operator-dev",
                  imagePullPolicy: "Always",
                  ports: [
                    {
                      containerPort: 8064,
                      protocol: "TCP",
                    },
                  ],
                  readinessProbe: {
                    httpGet: {
                      path: "/health",
                      port: 8064,
                    },
                    failureThreshold: 20,
                    periodSeconds: 5,
                    initialDelaySeconds: 20,
                  },
                  livenessProbe: {
                    tcpSocket: {
                      port: 8064,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 20,
                  },
                },
              ],
            },
          },
        },
      },
      { parent: this.namespace }
    );

    this.registerOutputs({});
  }
}
