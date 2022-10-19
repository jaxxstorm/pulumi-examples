import * as pulumi from "@pulumi/pulumi";
import * as oci from "@pulumi/oci";
import { SubnetDistributor } from "./subnetDistributor";

export interface OciVcnAppArgs {
  compartmentId: pulumi.Output<string>;
  cidrBlock: string;
  dnsLabel?: pulumi.Input<string>;
  isIpv6enabled?: pulumi.Input<boolean>;
  createInternetGateway?: boolean;
  createNatGateway?: boolean;
  createServiceGateway?: boolean;
}

export class OciVcn extends pulumi.ComponentResource {
  vcn: oci.core.Vcn;
  igw?: oci.core.InternetGateway;
  natGateway?: oci.core.NatGateway;
  serviceGateway?: oci.core.ServiceGateway;
  publicSubnets: oci.core.Subnet[] = [];
  privateSubnets: oci.core.Subnet[] = [];
  igwRoute?: oci.core.RouteTable;
  natGatewayRoute?: oci.core.RouteTable;
  services?: Promise<oci.core.GetServicesResult>;
  publicSubnetIds: any[] = [];
  privateSubnetIds: any[] = [];
  publicRouteTable: oci.core.RouteTable;
  privateRouteTable: oci.core.RouteTable;

  constructor(
    name: string,
    args: OciVcnAppArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:OciVcn", name, {}, opts);

    this.vcn = new oci.core.Vcn(
      name,
      {
        compartmentId: args.compartmentId,
        cidrBlocks: [args.cidrBlock],
        dnsLabel: args.dnsLabel,
        isIpv6enabled: args.isIpv6enabled,
      },
      { parent: this }
    );

    const publicRouteTableRules: pulumi.Input<
      pulumi.Input<oci.types.input.Core.RouteTableRouteRule>[]
    > = [];
    const privateRouteTableRules: pulumi.Input<
      pulumi.Input<oci.types.input.Core.RouteTableRouteRule>[]
    > = [];

    // define some subnets
    const distributor = new SubnetDistributor(args.cidrBlock, 1); // oracle cloud subnets are regional, so only create 1

    this.publicSubnets = distributor.publicSubnets().map((cidr, index) => {
      let subnet = new oci.core.Subnet(
        `${name}-public-${index + 1}`,
        {
          vcnId: this.vcn.id,
          compartmentId: args.compartmentId,
          cidrBlock: cidr,
          prohibitPublicIpOnVnic: false,
        },
        { parent: this.vcn }
      );

      this.publicSubnetIds.push(subnet.id);

      return subnet;
    });

    this.privateSubnets = distributor.privateSubnets().map((cidr, index) => {
      let subnet = new oci.core.Subnet(
        `${name}-private-${index + 1}`,
        {
          vcnId: this.vcn.id,
          compartmentId: args.compartmentId,
          cidrBlock: cidr,
          prohibitPublicIpOnVnic: true,
        },
        { parent: this.vcn }
      );

      this.privateSubnetIds.push(subnet.id);

      return subnet;
    });

    // we're asking for an internet gateway
    if (args.createInternetGateway) {
      this.igw = new oci.core.InternetGateway(
        name,
        {
          compartmentId: args.compartmentId,
          vcnId: this.vcn.id,
        },
        { parent: this.vcn }
      );

      privateRouteTableRules.push({
        destination: "0.0.0.0/0",
        networkEntityId: this.igw.id,
        description: "Pulumi: Traffic to/from the internet",
      });
    }

    if (args.createServiceGateway) {
      this.services = oci.core.getServices({
        filters: [
          {
            name: "name",
            values: ["All .* Services In Oracle Services Network"],
            regex: true,
          },
        ],
      });

      this.serviceGateway = new oci.core.ServiceGateway(
        name,
        {
          vcnId: this.vcn.id,
          compartmentId: args.compartmentId,
          services: [
            {
              serviceId: this.services.then((svc) => svc.services[0].id),
            },
          ],
        },
        { parent: this.vcn, deleteBeforeReplace: true }
      );
    }

    // we want a nat gateway
    if (args.createNatGateway) {
      this.natGateway = new oci.core.NatGateway(
        name,
        {
          compartmentId: args.compartmentId,
          vcnId: this.vcn.id,
        },
        { parent: this.vcn }
      );

      const defaultRouteRules = {
        networkEntityId: this.natGateway.id,
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK",
        description: "Pulumi: Traffic to the internet",
      };

      publicRouteTableRules.push(defaultRouteRules);

      if (args.createServiceGateway) {
        publicRouteTableRules.push({
          destinationType: "SERVICE_CIDR_BLOCK",
          destination: this.services?.then((s) => s.services[0].cidrBlock),
          networkEntityId: this.serviceGateway!.id,
          description: "Pulumi: Traffic to Oracle services",
        });
      }
    }

    this.publicRouteTable = new oci.core.RouteTable(`${name}-public`, {
      compartmentId: args.compartmentId,
      vcnId: this.vcn.id,
      routeRules: publicRouteTableRules,
    });

    this.privateRouteTable = new oci.core.RouteTable(`${name}-private`, {
      compartmentId: args.compartmentId,
      vcnId: this.vcn.id,
      routeRules: privateRouteTableRules,
    });
  }
}
