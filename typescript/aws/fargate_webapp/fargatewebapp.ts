import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface FargateWebAppArgs {
    vpc: awsx.ec2.Vpc
    image: string;
}

export class FargateWebApp extends pulumi.ComponentResource {

    cluster: awsx.ecs.Cluster

    constructor(name: string, args: FargateWebAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("jaxxstorm:index:fargatewebapp", name, {}, opts);

        this.cluster = new awsx.ecs.Cluster(`${name}-cluster`, {
            vpc: args.vpc,
        });

    }

}