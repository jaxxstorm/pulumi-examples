import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as vpc from "./vpc";

const config = new pulumi.Config();

const key = config.requireSecret("tailscaleKey");

const myVpc = new vpc.Vpc("example", {
    publicSubnetCidr: "172.16.0.0/24",
    privateSubnetCidr: "172.16.1.0/24",
});

const image = gcp.compute.getImage({
    family: "ubuntu-2004-lts",
    project: "ubuntu-os-cloud",
});

const firewal = new gcp.compute.Firewall("example", {
    network: myVpc.network.id,
    allows: [{
        protocol: "tcp",
        ports: [ "22" ],
    }],
    targetTags: [ "bastion" ],
    sourceRanges: [ "0.0.0.0/0" ]
});

const userData = key.apply(key => `#!/bin/bash\n
export DEBIAN_FRONTEND=noninteractive
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update
sudo apt-get install tailscale
tailscale up --advertise-routes=172.16.0.0/22 --authkey=${key} --accept-dns=false`)

// const instance = new gcp.compute.Instance("example", {
//     machineType: "f1-micro",
//     bootDisk: {
//         initializeParams: {
//             image: image.then(image => image.selfLink),
//         }
//     },
//     networkInterfaces: [{
//         subnetwork: myVpc.privateSubnet.id,
//     }],
//     tags: [ "bastion" ],
//     metadata: {
//         'user-data': userData
//     }
// })

// export const instanceName = instance.name;

const template = new gcp.compute.InstanceTemplate("example", {
    machineType: "f1-micro",
    canIpForward: true,
    tags: [
        "bastion"
    ],
    disks: [{
        sourceImage: image.then(image => image.selfLink),
    }],
    networkInterfaces: [{
        subnetwork: myVpc.privateSubnet.id,
    }],
    metadata: {
        'user-data': userData
    }
})

const targetPool = new gcp.compute.TargetPool("example", {})

const groupManager = new gcp.compute.InstanceGroupManager("example", {
    versions: [{
        instanceTemplate: template.id,
    }],
    targetPools: [ targetPool.id ],
    baseInstanceName: "bastion",  
})

const autoscaler = new gcp.compute.Autoscaler("example", {
    target: groupManager.id,
    autoscalingPolicy: {
        maxReplicas: 1,
        minReplicas: 1,
    }
})
