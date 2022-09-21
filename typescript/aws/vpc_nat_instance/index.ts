import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as nat from "./natInstance";

const vpc = new awsx.ec2.Vpc("natInstance", {
  numberOfAvailabilityZones: 2,
  cidrBlock: "172.20.0.0/22",
  natGateways: {
    strategy: "None",
  },
});

const ami = aws.ec2.getAmiOutput({
  mostRecent: true,
  owners: ["amazon"],
  filters: [
    {
      name: "architecture",
      values: ["x86_64"],
    },
    {
      name: "root-device-type",
      values: ["ebs"],
    },
    {
      name: "name",
      values: ["amzn2-ami-hvm-*"],
    },
    {
      name: "virtualization-type",
      values: ["hvm"],
    },
    {
      name: "block-device-mapping.volume-type",
      values: ["gp2"],
    },
  ],
});

export const ids = vpc.privateRouteTableIds

vpc.privateRouteTableIds.apply(ids => {
    ids.forEach((id, index) => {
        new nat.NatInstance(`route-to-internet-${index}`, {
            vpcId: vpc.vpcId,
            publicSubnetId: vpc.publicSubnetIds[0],
            imageId: ami.id,
            routeTableId: id,
        })
    })

})

