import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface TransitGatewayAttachedVpcArgs {
    cidrBlock: string | undefined;
    transitGatewayId: pulumi.Input<string>
}

export class TransitGatewayAttachedVpc extends pulumi.ComponentResource {

    vpc: awsx.ec2.Vpc;
    transitGatewayAttachment: aws.ec2transitgateway.VpcAttachment;

    constructor(name: string, args: TransitGatewayAttachedVpcArgs, opts?: pulumi.ComponentResourceOptions) {
        super("jaxxstorm:index:TransitGatewayAttachedVpc", name, {}, opts);

        this.vpc = new awsx.ec2.Vpc(name, {
            cidrBlock: args.cidrBlock,
            subnets: [
                { type: "public"  },
                { type: "private" },
                { type: "isolated" },
            ],
            tags: {
                Name: name,
            }
        }, { parent: this })

        this.transitGatewayAttachment = new aws.ec2transitgateway.VpcAttachment(name, {
            transitGatewayId: args.transitGatewayId,
            vpcId: this.vpc.id,
            subnetIds: this.vpc.isolatedSubnetIds,
            tags: {
                Name: name,
            }
        }, { parent: this, dependsOn: this.vpc.isolatedSubnets })

    }

}