import * as pulumi from "@pulumi/pulumi";
import * as istio from "./istio";

export interface IngressCanaryArgs {
    namespace: pulumi.Input<string>;
    istioSelector?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    http: pulumi.Input<pulumi.Input<istio.types.input.networking.v1alpha3.VirtualServiceSpecHttpArgs>[]>;
    subsets: pulumi.Input<pulumi.Input<istio.types.input.networking.v1alpha3.DestinationRuleSpecSubsetsArgs>[]>;
}

export class IngressCanary extends pulumi.ComponentResource {
  
    gateway: istio.networking.v1alpha3.Gateway;
    virtualService: istio.networking.v1alpha3.VirtualService;
    destination: istio.networking.v1alpha3.DestinationRule
    private readonly name: string;
  
    constructor(
      name: string,
      args: IngressCanaryArgs,
      opts?: pulumi.ComponentResourceOptions
    ) {
      super("jaxxstorm:index:IngressCanary", name, {}, opts);
  
      this.name = name;

      this.gateway = new istio.networking.v1alpha3.Gateway(name, {
        metadata: {
          namespace: args.namespace,
          name: name,
        },
        spec: {
          selector: {
            istio: args.istioSelector || "ingressgateway",
          },
          servers: [
            {
              port: {
                number: 80,
                name: "http",
                protocol: "HTTP",
              },
              hosts: ["*"],
            },
          ],
        },
      }, { parent: this });

      this.virtualService = new istio.networking.v1alpha3.VirtualService(name, {
        metadata: {
          namespace: args.namespace,
        },
        spec: {
          hosts: ["*"],
          gateways: [ name ] ,
          http: args.http,
        },
      }, { parent: this });

      this.destination = new istio.networking.v1alpha3.DestinationRule(name, {
        metadata: {
          namespace: args.namespace
        },
        spec: {
          host: args.host,
          subsets: args.subsets,
          
        }
      }, { parent: this })
      

    }
}