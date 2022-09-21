import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface NatInstanceArgs {
  vpcId: pulumi.Input<string>;
  publicSubnetId: pulumi.Input<string>;
  imageId: pulumi.Input<string>;
  routeTableId: pulumi.Input<string>;
}

export class NatInstance extends pulumi.ComponentResource {
  securityGroup: aws.ec2.SecurityGroup;
  networkInterface: aws.ec2.NetworkInterface;
  launchTemplate: aws.ec2.LaunchTemplate;
  autoScalingGroup: aws.autoscaling.Group;

  constructor(
    name: string,
    args: NatInstanceArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:NatInstance", name, {}, opts);

    this.securityGroup = new aws.ec2.SecurityGroup(
      name,
      {
        description: "all",
        vpcId: args.vpcId,
        ingress: [
          { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
        ],
        egress: [
          { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
        ],
        tags: {
          Name: name,
        },
      },
      { parent: this }
    );

    this.networkInterface = new aws.ec2.NetworkInterface(name, {
        securityGroups: [this.securityGroup.id],
        subnetId: args.publicSubnetId,
      }, { parent: this });
    
      new aws.ec2.Route(name, {
        routeTableId: args.routeTableId,
        destinationCidrBlock: "0.0.0.0/0",
        networkInterfaceId: this.networkInterface.id,
      }, { parent: this })


    const role = new aws.iam.Role(name, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
      }),
    }, { parent: this });

    const instanceProfile = new aws.iam.InstanceProfile(name, {
      role: role.name,
    }, { parent: role });

    const eniPolicy = new aws.iam.RolePolicy(name, {
      role: role.name,
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: ["ec2:AttachNetworkInterface"],
            Effect: "Allow",
            Resource: "*",
          },
        ],
      } as aws.iam.PolicyDocument,
    }, { parent: role });

    this.launchTemplate = new aws.ec2.LaunchTemplate(name, {
      imageId: args.imageId,
      iamInstanceProfile: {
        arn: instanceProfile.arn,
      },
      instanceType: "t3.micro",
      networkInterfaces: [
        {
          associatePublicIpAddress: "true",
          securityGroups: [this.securityGroup.id],
          deleteOnTermination: "true",
        },
      ],
      description: "Launch template for a NAT instance",
    }, { parent: this });

    this.autoScalingGroup = new aws.autoscaling.Group(name, {
      desiredCapacity: 1,
      minSize: 1,
      maxSize: 1,
      vpcZoneIdentifiers: [args.publicSubnetId],
      launchTemplate: {
        id: this.launchTemplate.id,
        version: `$Latest`,
      }
    //   mixedInstancesPolicy: {
    //     instancesDistribution: {
    //       onDemandBaseCapacity: 1,
    //       onDemandPercentageAboveBaseCapacity: 100,
    //     },
    //     launchTemplate: {
    //       launchTemplateSpecification: {
    //         launchTemplateId: this.launchTemplate.id,
    //         version: `$Latest`,
    //       },
    //     },
    //   },
    }, { parent: this.launchTemplate });
  }
}
