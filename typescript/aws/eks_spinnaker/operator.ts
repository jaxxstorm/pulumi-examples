import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface SpinnakerOperatorArgs {
  version?: string;
}

export class SpinnakerOperator extends pulumi.ComponentResource {
  namespace: kubernetes.core.v1.Namespace;
  deployment: kubernetes.apps.v1.Deployment;
  serviceAccount: kubernetes.core.v1.ServiceAccount;
  role: kubernetes.rbac.v1.ClusterRole;
  roleBinding: kubernetes.rbac.v1.ClusterRoleBinding;

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

    this.role = new kubernetes.rbac.v1.ClusterRole(
      name,
      {
        metadata: {
          name: name,
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["pods", "ingresses/status", "endpoints"],
            verbs: ["get", "list", "watch"],
          },
          {
            apiGroups: [""],
            resources: [
              "services",
              "events",
              "configmaps",
              "secrets",
              "namespaces",
              "ingresses",
            ],
            verbs: ["create", "get", "list", "update", "watch", "patch"],
          },
          {
            apiGroups: ["apps", "extensions"],
            resources: [
              "deployments",
              "daemonsets",
              "replicasets",
              "statefulsets",
            ],
            verbs: ["create", "get", "list", "update", "watch", "patch"],
          },
          {
            apiGroups: ["monitoring.coreos.com"],
            resources: ["servicemonitors"],
            verbs: ["get", "create"],
          },
          {
            apiGroups: ["spinnaker.io"],
            resources: ["*", "spinnakerservices"],
            verbs: ["create", "get", "list", "update", "watch", "patch"],
          },
          {
            apiGroups: ["admissionregistration.k8s.io"],
            resources: ["validatingwebhookconfigurations"],
            verbs: ["*"],
          },
          {
            apiGroups: ["networking.k8s.io", "extensions"],
            resources: ["ingresses"],
            verbs: ["get", "list", "watch"],
          },
        ],
      },
      { parent: this }
    );

    this.roleBinding = new kubernetes.rbac.v1.ClusterRoleBinding(
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
          kind: "ClusterRole",
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
          name: name,
          namespace: this.namespace.metadata.name,
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
                  image: "armory/spinnaker-operator:1.2.5",
                  command: ["spinnaker-operator"],
                  imagePullPolicy: "IfNotPresent",
                  env: [
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
                  ports: [
                    {
                      containerPort: 9876,
                      protocol: "TCP",
                      name: "http",
                    },
                  ],
                },
                {
                  name: "halyard",
                  image: "armory/halyard:operator-ccae06e",
                  imagePullPolicy: "IfNotPresent",
                  ports: [
                    {
                      containerPort: 8064,
                      protocol: "TCP",
                      name: "http",
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
