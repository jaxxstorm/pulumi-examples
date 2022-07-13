import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as tgw from "./sharedTransitGateway";
import * as vpc from "./transitGatewayAttachedVpc";
import * as asg from "./autoScalingGroup";

const config = new pulumi.Config();
const publicKey = config.require("publicKey");

const devProvider = new aws.Provider("dev", {
  profile: "personal-development",
});
const transitProvider = new aws.Provider("transit", {
  profile: "personal-transit",
});
const prodProvider = new aws.Provider("prod", {
  profile: "personal-production",
});

const transitGw = new tgw.SharedTransitGateway(
  "lbriggs",
  {
    sharePrincipal:
      "arn:aws:organizations::609316800003:organization/o-fjlzoklj5f",
  },
  { provider: transitProvider, parent: transitProvider }
);

const devVpc = new vpc.TransitGatewayAttachedVpc(
  "dev",
  {
    cidrBlock: "172.19.0.0/22",
    transitGatewayId: transitGw.transitGateway.id,
  },
  { provider: devProvider, parent: devProvider, dependsOn: transitGw }
);

const prodVpc = new vpc.TransitGatewayAttachedVpc(
  "prod",
  {
    cidrBlock: "172.18.0.0/22",
    transitGatewayId: transitGw.transitGateway.id,
  },
  { provider: prodProvider, parent: prodProvider, dependsOn: transitGw }
);

const devRoutes = aws.ec2.getRouteTablesOutput(
  {
    vpcId: devVpc.vpc.id,
  },
  { provider: devProvider }
);

devRoutes.ids.apply((routeIds) => {
  routeIds.forEach((routeId, index) => {
    new aws.ec2.Route(
      `route-to-prod-${index}`,
      {
        routeTableId: routeId,
        destinationCidrBlock: "172.18.0.0/22",
        transitGatewayId: transitGw.transitGateway.id,
      },
      { provider: devProvider, parent: prodProvider }
    );
  });
});

const prodRoutes = aws.ec2.getRouteTablesOutput(
  {
    vpcId: prodVpc.vpc.id,
  },
  { provider: prodProvider }
);

prodRoutes.ids.apply((routeIds) => {
  routeIds.forEach((routeId, index) => {
    new aws.ec2.Route(
      `route-to-dev-${index}`,
      {
        routeTableId: routeId,
        destinationCidrBlock: "172.19.0.0/22",
        transitGatewayId: transitGw.transitGateway.id,
      },
      { provider: prodProvider, parent: prodProvider }
    );
  });
});

const devAmi = aws.ec2.getAmiOutput(
  {
    owners: ["amazon"],
    mostRecent: true,
    filters: [
      {
        name: "name",
        values: ["amzn2-ami-hvm-2.0.????????-x86_64-gp2"],
      },
    ],
  },
  { provider: devProvider, parent: devProvider }
);

const prodAmi = aws.ec2.getAmiOutput(
  {
    owners: ["amazon"],
    mostRecent: true,
    filters: [
      {
        name: "name",
        values: ["amzn2-ami-hvm-2.0.????????-x86_64-gp2"],
      },
    ],
  },
  { provider: prodProvider, parent: prodProvider }
);


const devInstances = new asg.AutoScalingGroup(
  "dev",
  {
    publicKey: publicKey,
    amiId: devAmi.id,
    vpcId: devVpc.vpc.id,
    subnetIds: devVpc.vpc.publicSubnetIds,
  },
  { provider: devProvider, parent: devProvider }
);

const prodInstances = new asg.AutoScalingGroup(
  "prod",
  {
    publicKey: publicKey,
    amiId: prodAmi.id,
    vpcId: prodVpc.vpc.id,
    subnetIds: prodVpc.vpc.publicSubnetIds,
  },
  { provider: prodProvider, parent: prodProvider }
);
