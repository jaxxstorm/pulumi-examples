import * as pulumi from "@pulumi/pulumi";
import * as istio from "./istio";

export interface WeightedIstioServiceArgs {
  namespace: pulumi.Input<string>;
  host: pulumi.Input<string>;
  http: pulumi.Input<
    pulumi.Input<istio.types.input.networking.v1alpha3.VirtualServiceSpecHttpArgs>[]
  >;
  subsets: pulumi.Input<pulumi.Input<istio.types.input.networking.v1alpha3.DestinationRuleSpecSubsetsArgs>[]>;
}

export class WeightedIstioService extends pulumi.ComponentResource {
  virtualService: istio.networking.v1alpha3.VirtualService;
  destinationRule: istio.networking.v1alpha3.DestinationRule;
  private readonly name: string;

  constructor(
    name: string,
    args: WeightedIstioServiceArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:IstioCanary", name, {}, opts);

    this.name = name;

    this.virtualService = new istio.networking.v1alpha3.VirtualService(
      name,
      {
        metadata: {
          namespace: args.namespace,
        },
        spec: {
          hosts: [ args.host ],
          gateways: [name],
          http: args.http,
        },
      },
      { parent: this }
    );

    this.destinationRule = new istio.networking.v1alpha3.DestinationRule(name, {
        metadata: {
            namespace: args.namespace,
        },
        spec: {
            host: args.host,
            subsets: args.subsets,
        }
    }, { parent: this })

  }
}
