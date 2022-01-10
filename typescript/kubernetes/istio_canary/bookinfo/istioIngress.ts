import * as pulumi from "@pulumi/pulumi";
import * as istio from "./istio";

export interface IstioIngressArgs {
  namespace: pulumi.Input<string>;
  istioSelector?: pulumi.Input<string>;
  host: pulumi.Input<string>;
  http: pulumi.Input<
    pulumi.Input<istio.types.input.networking.v1alpha3.VirtualServiceSpecHttpArgs>[]
  >;
}

export class IstioIngress extends pulumi.ComponentResource {
  gateway: istio.networking.v1alpha3.Gateway;
  virtualService: istio.networking.v1alpha3.VirtualService;
  private readonly name: string;

  constructor(
    name: string,
    args: IstioIngressArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:IstioIngress", name, {}, opts);

    this.name = name;

    this.gateway = new istio.networking.v1alpha3.Gateway(
      name,
      {
        metadata: {
          namespace: args.namespace,
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
      },
      { parent: this }
    );

    this.virtualService = new istio.networking.v1alpha3.VirtualService(
      name,
      {
        metadata: {
          namespace: args.namespace,
        },
        spec: {
          hosts: ["*"],
          gateways: [
            pulumi.Output.create(this.gateway.metadata).apply(
              (metadata) => metadata!.name!
            ),
          ],
          http: args.http,
        },
      },
      { parent: this }
    );
  }
}
