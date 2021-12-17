import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const name = "fargate-example"

// define a VPC
const vpc = new awsx.ec2.Vpc(`${name}-vpc`, {
    cidrBlock: "172.16.0.0/24",
    subnets: [
        {
            type: "private",
            tags: {
                "kubernetes.io/role/internal-elb": "1",
            }
        },
        {
            type: "public",
            tags: {
                "kubernetes.io/role/elb": "1",
            }
        }],
    tags: {
        Name: `${name}-vpc`,
        Owner: "lbriggs",
        owner: "lbriggs",
    }
});

// define a cluster
const cluster = new awsx.ecs.Cluster(`${name}-cluster`, {
    vpc: vpc,
});

const alb = new awsx.elasticloadbalancingv2.ApplicationLoadBalancer(`${name}-alb`, 
    { 
        external: true, 
        securityGroups: cluster.securityGroups,
        vpc: vpc,
    });

    
const http = alb.createListener(`${name}-http`, { 
    port: 80, 
    external: true,
});

// // fargate task
const appService = new awsx.ecs.FargateService(`${name}-fgservice`, {
    cluster,
    taskDefinitionArgs: {
        container: {
            image: "nginx:latest",
            cpu: 102,
            memory: 50,
            portMappings: [ http ],
        },
    },
    desiredCount: 5,
    subnets: vpc.privateSubnetIds, 
});

const zone = aws.route53.getZone({
    name: "aws.briggs.work"
})

const record = new aws.route53.Record(`${name}-record`, {
    zoneId: zone.then(zone => zone.zoneId),
    type: "CNAME",
    name: "fargate-example-app",
    records: [
        http.endpoint.hostname,
    ],
    ttl: 5,
})

const certificate = new aws.acm.Certificate(`${name}-cert`, {
    domainName: pulumi.interpolate`fargate-example-app.${record.fqdn}`,
    validationMethod: "DNS"
})

const certificateValidationDomain = new aws.route53.Record(`${name}-validationRecord`, {
    name: certificate.domainValidationOptions[0].resourceRecordName,
    zoneId: zone.then(zone => zone.zoneId),
    type: certificate.domainValidationOptions[0].resourceRecordType,
    records: [certificate.domainValidationOptions[0].resourceRecordValue],
    ttl: 60,
});

const certificateValidation = new aws.acm.CertificateValidation(`${name}-certificateValidation`, {
    certificateArn: certificate.arn,
    validationRecordFqdns: [certificateValidationDomain.fqdn],
});




const https = alb.createListener(`${name}-https`, {
    port: 443,
    external: true,
    protocol: "HTTPS",
    certificateArn: certificate.arn,
})

export const host = record.fqdn
export const url = https.endpoint.hostname;

