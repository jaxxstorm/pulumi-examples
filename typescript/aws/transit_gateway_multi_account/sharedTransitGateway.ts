import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface SharedTransitGatewayArgs {
    sharePrincipal: pulumi.Input<string>
}

export class SharedTransitGateway extends pulumi.ComponentResource {

    transitGateway: aws.ec2transitgateway.TransitGateway;
    ramResourceShare: aws.ram.ResourceShare;
    ramResourceAssociation: aws.ram.ResourceAssociation;
    ramPrincipalAssociation: aws.ram.PrincipalAssociation;

    constructor(name: string, args: SharedTransitGatewayArgs, opts?: pulumi.ComponentResourceOptions) {
        super("jaxxstorm:index:sharedTransitGateway", name, {}, opts);

        this.transitGateway = new aws.ec2transitgateway.TransitGateway(name, {
            amazonSideAsn: 65432,
            defaultRouteTableAssociation: "enable",
            defaultRouteTablePropagation: "enable",
            autoAcceptSharedAttachments: "enable",
            multicastSupport: "enable",
            vpnEcmpSupport: "enable",
            dnsSupport: "enable",
            tags: {
                Name: name,
            }
        }, { parent: this })

        this.ramResourceShare = new aws.ram.ResourceShare(name, {
            allowExternalPrincipals: true,
            tags: {
                Name: name,
            }
        }, { parent: this, deleteBeforeReplace: true, })

        this.ramResourceAssociation = new aws.ram.ResourceAssociation(name, {
            resourceArn: this.transitGateway.arn,
            resourceShareArn: this.ramResourceShare.arn,
        }, { parent: this.ramResourceShare })

        this.ramPrincipalAssociation = new aws.ram.PrincipalAssociation(name, {
            resourceShareArn: this.ramResourceShare.arn,
            principal: args.sharePrincipal,
        }, { parent: this.ramResourceShare })

    }

}