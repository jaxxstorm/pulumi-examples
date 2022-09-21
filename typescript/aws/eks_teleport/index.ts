import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

const vpc = new awsx.ec2.Vpc(
    "teleport",
    {
      cidrBlock: "172.16.0.0/20",
      subnetSpecs: [{
        type: "Public",
        cidrMask: 26
      }, {
        type: "Isolated",
        cidrMask: 26
      }, {
        type: "Private",
        cidrMask: 24
      }],
      natGateways: {
        strategy: "OnePerAz"
      },
      tags: {
        Name: "teleport",
      },
    },
  );

const kubeconfigOpts: eks.KubeconfigOptions = {profileName: "personal-management"};

const cluster = new eks.Cluster("teleport", {
    providerCredentialOpts: kubeconfigOpts,
    vpcId: vpc.vpcId,
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

export const kubeconfig = cluster.kubeconfig

const k8sProvider = k8s.Provider()
