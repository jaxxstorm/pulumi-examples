import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

export interface HarnessDelegateArgs {
    accountId: pulumi.Input<string>
    delegateToken: pulumi.Input<string>
}

export class HarnessDelegate extends pulumi.ComponentResource {

    namespace: kubernetes.core.v1.Namespace;
    clusterRoleBinding: kubernetes.rbac.v1.ClusterRoleBinding;
    secret: kubernetes.core.v1.Secret;
    statefulSet: kubernetes.apps.v1.StatefulSet;
    service: kubernetes.core.v1.Service;

    constructor(name: string, args: HarnessDelegateArgs, opts?: pulumi.ComponentResourceOptions) {
        super("harness:index:Delegate", name, {}, opts);

        const labels = {
            "harness.io/name": name,
        }

        this.namespace = new kubernetes.core.v1.Namespace(name, {
            metadata: {
                name: name
            }
        }, { parent: this })

        this.clusterRoleBinding = new kubernetes.rbac.v1.ClusterRoleBinding(name, {
            metadata: {
                name: name,
                labels: labels,
            },
            subjects: [{
                kind: "ServiceAccount",
                name: "default",
                namespace: this.namespace.metadata.name,
            }],
            roleRef: {
                kind: "ClusterRole",
                name: "cluster-admin",
                apiGroup: "rbac.authorization.k8s.io",
            },
        }, { parent: this});

        this.secret = new kubernetes.core.v1.Secret(name, {
            metadata: {
                namespace: this.namespace.metadata.name,
            },
            type: "Opaque",
            data: {
                PROXY_USER: "",
                PROXY_PASSWORD: "",
            },
        }, { parent: this.namespace });

        this.service = new kubernetes.core.v1.Service(name, {
            metadata: {
                namespace: this.namespace.metadata.name,
                annotations: {
                    "pulumi.com/skipAwait": "true"
                }
            },
            spec: {
                type: "ClusterIP",
                selector: labels,
                ports: [{
                    port: 8080,
                }],
            },
        }, { parent: this.namespace });

        this.statefulSet = new kubernetes.apps.v1.StatefulSet(name, {
            metadata: {
                labels: labels,
                namespace: this.namespace.metadata.name,
            },
            spec: {
                replicas: 2,
                podManagementPolicy: "Parallel",
                selector: {
                    matchLabels: labels,
                },
                serviceName: this.service.metadata.name,
                template: {
                    metadata: {
                        labels: labels,
                    },
                    spec: {
                        containers: [{
                            image: "harness/delegate:latest",
                            imagePullPolicy: "Always",
                            name: "harness-delegate-instance",
                            ports: [{
                                containerPort: 8080,
                            }],
                            resources: {
                                limits: {
                                    cpu: "0.5",
                                    memory: "2048Mi",
                                },
                                requests: {
                                    cpu: "0.5",
                                    memory: "2048Mi",
                                },
                            },
                            readinessProbe: {
                                exec: {
                                    command: [
                                        "test",
                                        "-s",
                                        "delegate.log",
                                    ],
                                },
                                initialDelaySeconds: 20,
                                periodSeconds: 10,
                            },
                            livenessProbe: {
                                exec: {
                                    command: [
                                        "bash",
                                        "-c",
                                        `[[ -e /opt/harness-delegate/msg/data/watcher-data && $(($(date +%s000) - $(grep heartbeat /opt/harness-delegate/msg/data/watcher-data | cut -d ":" -f 2 | cut -d "," -f 1))) -lt 300000 ]]`,
                                    ],
                                },
                                initialDelaySeconds: 240,
                                periodSeconds: 10,
                                failureThreshold: 2,
                            },
                            env: [
                                {
                                    name: "JAVA_OPTS",
                                    value: "-Xms64M",
                                },
                                {
                                    name: "ACCOUNT_ID",
                                    value: args.accountId,
                                },
                                {
                                    name: "MANAGER_HOST_AND_PORT",
                                    value: "https://app.harness.io/gratis",
                                },
                                {
                                    name: "DEPLOY_MODE",
                                    value: "KUBERNETES",
                                },
                                {
                                    name: "DELEGATE_NAME",
                                    value: name,
                                },
                                {
                                    name: "DELEGATE_TYPE",
                                    value: "KUBERNETES",
                                },
                                {
                                    name: "DELEGATE_NAMESPACE",
                                    valueFrom: {
                                        fieldRef: {
                                            fieldPath: "metadata.namespace",
                                        },
                                    },
                                },
                                {
                                    name: "INIT_SCRIPT",
                                    value: "",
                                },
                                {
                                    name: "DELEGATE_DESCRIPTION",
                                    value: "",
                                },
                                {
                                    name: "DELEGATE_TAGS",
                                    value: "",
                                },
                                {
                                    name: "NEXT_GEN",
                                    value: "true",
                                },
                                {
                                    name: "DELEGATE_TOKEN",
                                    value: args.delegateToken,
                                },
                                {
                                    name: "WATCHER_STORAGE_URL",
                                    value: "https://app.harness.io/public/free/freemium/watchers",
                                },
                                {
                                    name: "WATCHER_CHECK_LOCATION",
                                    value: "current.version",
                                },
                                {
                                    name: "DELEGATE_STORAGE_URL",
                                    value: "https://app.harness.io",
                                },
                                {
                                    name: "DELEGATE_CHECK_LOCATION",
                                    value: "delegatefree.txt",
                                },
                                {
                                    name: "HELM_DESIRED_VERSION",
                                    value: "",
                                },
                                {
                                    name: "CDN_URL",
                                    value: "https://app.harness.io",
                                },
                                {
                                    name: "REMOTE_WATCHER_URL_CDN",
                                    value: "https://app.harness.io/public/shared/watchers/builds",
                                },
                                {
                                    name: "JRE_VERSION",
                                    value: "11.0.14",
                                },
                                {
                                    name: "HELM3_PATH",
                                    value: "",
                                },
                                {
                                    name: "HELM_PATH",
                                    value: "",
                                },
                                {
                                    name: "KUSTOMIZE_PATH",
                                    value: "",
                                },
                                {
                                    name: "KUBECTL_PATH",
                                    value: "",
                                },
                                {
                                    name: "POLL_FOR_TASKS",
                                    value: "false",
                                },
                                {
                                    name: "ENABLE_CE",
                                    value: "false",
                                },
                                {
                                    name: "PROXY_HOST",
                                    value: "",
                                },
                                {
                                    name: "PROXY_PORT",
                                    value: "",
                                },
                                {
                                    name: "PROXY_SCHEME",
                                    value: "",
                                },
                                {
                                    name: "NO_PROXY",
                                    value: "",
                                },
                                {
                                    name: "PROXY_MANAGER",
                                    value: "true",
                                },
                                {
                                    name: "PROXY_USER",
                                    valueFrom: {
                                        secretKeyRef: {
                                            name: this.secret.metadata.name,
                                            key: "PROXY_USER",
                                        },
                                    },
                                },
                                {
                                    name: "PROXY_PASSWORD",
                                    valueFrom: {
                                        secretKeyRef: {
                                            name: this.secret.metadata.name,
                                            key: "PROXY_PASSWORD",
                                        },
                                    },
                                },
                                {
                                    name: "GRPC_SERVICE_ENABLED",
                                    value: "true",
                                },
                                {
                                    name: "GRPC_SERVICE_CONNECTOR_PORT",
                                    value: "8080",
                                },
                            ],
                        }],
                        restartPolicy: "Always",
                    },
                },
            },
        }, { parent: this.namespace });

    }

}