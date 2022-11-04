import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface VpcArgs {
  publicSubnetCidr: pulumi.Input<string>;
  privateSubnetCidr: pulumi.Input<string>;
}

export class Vpc extends pulumi.ComponentResource {
  public readonly network: gcp.compute.Network;
  public readonly router: gcp.compute.Router;
  public readonly publicSubnet: gcp.compute.Subnetwork;
  public readonly privateSubnet: gcp.compute.Subnetwork;
  public readonly routerNat: gcp.compute.RouterNat;

  constructor(
    name: string,
    args: VpcArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:Vpc", name, args, opts);

    this.network = new gcp.compute.Network(
      `${name}-vpc`,
      {
        autoCreateSubnetworks: false,
        routingMode: "REGIONAL",
      },
      { parent: this }
    );

    this.router = new gcp.compute.Router(
      `${name}-router`,
      {
        network: this.network.id,
      },
      { parent: this.network }
    );

    this.publicSubnet = new gcp.compute.Subnetwork(
      `${name}-public`,
      {
        ipCidrRange: args.publicSubnetCidr,
        network: this.network.id,
        privateIpGoogleAccess: true,
      },
      { parent: this.network }
    );

    this.privateSubnet = new gcp.compute.Subnetwork(`${name}-private`, {
        ipCidrRange: args.privateSubnetCidr,
        network: this.network.id,
        privateIpGoogleAccess: true,
      }, { parent: this.network});

    this.routerNat = new gcp.compute.RouterNat(
      `${name}-nat`,
      {
        router: this.router.name,
        natIpAllocateOption: "AUTO_ONLY",
        sourceSubnetworkIpRangesToNat: "LIST_OF_SUBNETWORKS",
        subnetworks: [
          {
            name: this.publicSubnet.selfLink,
            sourceIpRangesToNats: ["ALL_IP_RANGES"],
          },
          {
            name: this.privateSubnet.selfLink,
            sourceIpRangesToNats: ["ALL_IP_RANGES"],
          }
        ],
      },
      { parent: this.router }
    );


  }
}
