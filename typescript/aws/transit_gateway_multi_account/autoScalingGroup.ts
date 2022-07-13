import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface AutoScalingGroupArgs {
  publicKey: pulumi.Input<string>;
  amiId: pulumi.Input<string>;
  vpcId: pulumi.Input<string>;
  instanceType?: pulumi.Input<string>;
  subnetIds: pulumi.Input<pulumi.Input<string>[]> | undefined
}

export class AutoScalingGroup extends pulumi.ComponentResource {
  keypair: aws.ec2.KeyPair;
  securityGroup: aws.ec2.SecurityGroup;
  launchTemplate: aws.ec2.LaunchTemplate;
  autoScalingGroup: aws.autoscaling.Group;


  constructor(
    name: string,
    args: AutoScalingGroupArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:autoScalingGroup", name, {}, opts);

    this.keypair = new aws.ec2.KeyPair(name, {
      publicKey: args.publicKey,
      tags: {
        Name: name,
      }
    }, { parent: this });

    this.securityGroup = new aws.ec2.SecurityGroup(name, {
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
      }
    }, { parent: this });

    this.launchTemplate = new aws.ec2.LaunchTemplate(name, {
      imageId: args.amiId,
      instanceType: args.instanceType || "t3.micro",
      keyName: this.keypair.keyName,
      vpcSecurityGroupIds: [this.securityGroup.id],
      tags: {
        Name: name,
      }
    }, { parent: this });

    this.autoScalingGroup = new aws.autoscaling.Group(name, {
        maxSize: 1,
        minSize: 1,
        vpcZoneIdentifiers: args.subnetIds,
        launchTemplate: {
            id: this.launchTemplate.id,
            version: `$Latest`
        },
        tags: [{
            key: "Name",
            value: name,
            propagateAtLaunch: true,
        }]
    }, { parent: this.launchTemplate })



  }
}
