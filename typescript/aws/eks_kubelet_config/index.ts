import * as pulumi from "@pulumi/pulumi"
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as cloudinit from "@pulumi/cloudinit";

const name = 'nginx-helm-helm'

const config = new pulumi.Config("aws");
const profile = config.require("profile")

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

const kubeconfigOpts: eks.KubeconfigOptions = {profileName: profile};

const cluster = new eks.Cluster(name, {
    providerCredentialOpts: kubeconfigOpts,
    vpcId: vpc.id,
    privateSubnetIds: vpc.privateSubnetIds,
    publicSubnetIds: vpc.publicSubnetIds,
    instanceType: "t2.medium",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 2,
    createOidcProvider: true,
    tags: {
        Owner: "lbriggs",
        owner: "lbriggs",
    }
});

// JSON format extra configuration
const kubeletExtraConfig = JSON.stringify({
    kubeReserved: {
        memory: "128Mi",
    },
    kubeReservedCgroup: "/kube-reserved",
    systemReserved: {
        memory: "25Mi",
    },
    evictionHard: {
        "memory.available": "50Mi"
    },
    featureGates: {
        "DynamicKubeletConfig": true
    },
    maxPods: 12,
});

// write out the JSON configured extra args, then splat them with jq
// once that's done, override the existing kubelet-config and restart it
const extraUserData = `
echo '${kubeletExtraConfig}' > /tmp/kubeletExtraConfig
jq -s '.[0] * .[1]' "/etc/kubernetes/kubelet/kubelet-config.json" /tmp/kubeletExtraConfig > /tmp/renderedKubeConfig
mv /tmp/renderedKubeConfig /etc/kubernetes/kubelet/kubelet-config.json
service kubelet restart
`

const group = new eks.NodeGroup("extra-nodegroup", {
    cluster: cluster,
    instanceType: "t3a.small",
    desiredCapacity: 1,
    nodeSubnetIds: vpc.publicSubnetIds,
    nodeUserData: extraUserData,
    autoScalingGroupTags: {
        "k8s.io/cluster-autoscaler/enabled": "true",
        [`k8s.io/cluster-autoscaler/${name}`]: "true",
    },
    keyName: "lbriggs",
});

vpc.privateSubnetIds.then(id => id.forEach((id, index) => {
    new aws.ec2.Tag(`subnettag-${index}`, {
        key: cluster.eksCluster.name.apply(name => `kubernetes.io/cluster/${name}`),
        resourceId: id,
        value: "owned",
    }, { parent: cluster})
}))

export const clusterName = cluster.eksCluster.name
export const kubeconfig = cluster.kubeconfig
export const oidcUrl = cluster.core.oidcProvider?.url
export const oidcArn = cluster.core.oidcProvider?.arn
