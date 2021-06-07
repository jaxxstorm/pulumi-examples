import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

// this interface defines your arguments for your component
export interface ProductionIngressArgs {
    namespace: string,
    host: string,
}

// this actually defines the component resource
export class ProductionIngress extends pulumi.ComponentResource {
    // this defines the different types on your component
    ingress: kubernetes.networking.v1.Ingress
    private readonly name: string

    constructor(name: string, args: ProductionIngressArgs, opts?: pulumi.ComponentResourceOptions) {
        super("productioningress:ingress:Ingress", name, {}, opts);

        this.name = name

        this.ingress = new kubernetes.networking.v1.Ingress(`${name}-ingress`, {
            metadata: {
                namespace: args.namespace,
                annotations: {
                    "alb.ingress.kubernetes.io/target-type": "ip",
                    "pulumi.io/skipAwait": "true",
                }
            },
            spec: {
                rules: [
                    {
                        host: args?.host,
                        http: {
                            paths: [{
                                path: "/*",
                                backend: {
                                    service: {
                                        name: "frontend",
                                        port: {
                                            name: "http",
                                        }
                                    }
                                }
                            }]
                        }
                    }
                ]
            }
        })

        this.registerOutputs()
    }

}