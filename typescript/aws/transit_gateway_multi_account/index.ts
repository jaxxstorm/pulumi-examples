import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as tgw from "./sharedTransitGateway";

const config = new pulumi.Config();
const publicKey = config.require("publicKey");

const devProvider = new aws.Provider("dev", {
    profile: "personal-dev"
})
const transitProvider = new aws.Provider("transit", {
    profile: "personal-transit"
})
const mgmtProvider = new aws.Provider("mgmt", {
    profile: "personal-mgmt"
})

const transitGw = new tgw.SharedTransitGateway("lbriggs", {
    sharePrincipal: "arn:aws:organizations::609316800003:organization/o-fjlzoklj5f"
})




const devKey = new aws.ec2.KeyPair("dev", {
    publicKey: publicKey
}, { provider: devProvider, parent: devProvider })

const mgmtKey = new aws.ec2.KeyPair("mgmt", {
    publicKey: publicKey
}, { provider: mgmtProvider, parent: mgmtProvider })

const devAmi = aws.ec2.getAmiOutput({
    owners: ["amazon"],
    mostRecent: true,
    filters: [{
        name: "name",
        values: ["amzn2-ami-hvm-2.0.????????-x86_64-gp2"],
    }],
}, { provider: devProvider, parent: devProvider });

const mgmtAmi = aws.ec2.getAmiOutput({
    owners: ["amazon"],
    mostRecent: true,
    filters: [{
        name: "name",
        values: ["amzn2-ami-hvm-2.0.????????-x86_64-gp2"],
    }],
}, { provider: mgmtProvider, parent: mgmtProvider });

const devSg = new aws.ec2.SecurityGroup("dev", {
    description: "all",
    vpcId: devVpc.id,
    ingress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
       
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }, 
    ],
}, { provider: devProvider, parent: devProvider });

const mgmtSg = new aws.ec2.SecurityGroup("mgmt", {
    description: "all",
    vpcId: mgmtVpc.id,
    ingress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
       
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }, 
    ],
}, { provider: mgmtProvider, parent: mgmtProvider });

const devLaunchTemplate = new aws.ec2.LaunchTemplate("dev", {
    imageId: devAmi.id,
    instanceType: "t3.micro",
    keyName: devKey.keyName,
    vpcSecurityGroupIds: [ devSg.id ],
}, { provider: devProvider, parent: devProvider })

const mgmtLaunchTemplate = new aws.ec2.LaunchTemplate("mgmt", {
    imageId: mgmtAmi.id,
    instanceType: "t3.micro",
    keyName: mgmtKey.keyName,
    vpcSecurityGroupIds: [ mgmtSg.id ],
}, { provider: mgmtProvider, parent: mgmtProvider })

const devAsg = new aws.autoscaling.Group("dev", {
    maxSize: 1,
    minSize: 1,
    vpcZoneIdentifiers: devVpc.publicSubnetIds,
    launchTemplate: {
        id: devLaunchTemplate.id,
        version: `$Latest`,
    }
}, { provider: devProvider, parent: devProvider })

const mgmtAsg = new aws.autoscaling.Group("mgmt", {
    maxSize: 1,
    desiredCapacity: 1,
    minSize: 0,
    vpcZoneIdentifiers: mgmtVpc.publicSubnetIds,
    launchTemplate: {
        id: mgmtLaunchTemplate.id,
        version: `$Latest`,
    }
}, { provider: mgmtProvider, parent: mgmtProvider })
