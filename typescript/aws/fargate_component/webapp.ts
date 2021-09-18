import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface FargateWebAppArgs {
    imagePath: string;
}

export class FargateWebApp extends pulumi.ComponentResource {

    cluster: awsx.ecs.Cluster
    web: awsx.elasticloadbalancingv2.Listener
    alb: awsx.elasticloadbalancingv2.ApplicationLoadBalancer
    image: awsx.ecs.Image
    appService: awsx.ecs.FargateService
    url: pulumi.Output<string>

    constructor(name: string, args: FargateWebAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("jaxxstorm:index:fargatewebapp", name, {}, opts);

        // define an ECS cluster
        this.cluster = new awsx.ecs.Cluster(name, {}, { parent: this });

        this.alb = new awsx.elasticloadbalancingv2.ApplicationLoadBalancer(
            "net-lb", { external: true, securityGroups: this.cluster.securityGroups }, { parent: this });
        
        this.web = this.alb.createListener(name, { port: 80, external: true }, { parent: this.alb });

        this.image = awsx.ecs.Image.fromPath(name, args.imagePath);

        this.appService = new awsx.ecs.FargateService(name, {
            cluster: this.cluster,
            taskDefinitionArgs: {
                container: {
                    image: this.image,
                    cpu: 102 /*10% of 1024*/,
                    memory: 50 /*MB*/,
                    portMappings: [ this.web ],
                },
            },
            desiredCount: 5,
        }, { parent: this });


        this.url = this.web.endpoint.hostname

        this.registerOutputs({
            url: this.url
        });


    }

}