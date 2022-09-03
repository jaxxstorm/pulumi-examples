import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as operator from "./operator";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config()
const pubKey = config.require("publicKey")

const role = new aws.iam.Role("spinnaker", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com"
    })
})


const managedPolicyArns: string[] = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
];

managedPolicyArns.forEach((policy, index) => {
    new aws.iam.RolePolicyAttachment(`spinnaker-workernode-policy-${index}`, {
        policyArn: policy,
        role: role
    })
})

// create an EKS cluster
const cluster = new eks.Cluster("spinnaker", {
  minSize: 1,
  desiredCapacity: 3,
  maxSize: 5,
  instanceType: "t3.xlarge",
  version: "1.21", // FIXME: need to transform CRDs if using a newer eks version
  instanceRole: role,
  nodePublicKey: pubKey,
});

const k8sProvider = new k8s.Provider("spinnaker", {
  enableServerSideApply: true,
  kubeconfig: cluster.kubeconfig,
});

const crds = new k8s.yaml.ConfigGroup(
  "spinnaker",
  {
    files: [
      "https://raw.githubusercontent.com/armory/spinnaker-operator/master/deploy/crds/spinnaker.io_spinnakeraccounts.yaml",
      "https://raw.githubusercontent.com/armory/spinnaker-operator/master/deploy/crds/spinnaker.io_spinnakerservices.yaml",
    ],
  },
  { provider: k8sProvider }
);

const operatorDeployment = new operator.SpinnakerOperator(
  "spinnaker-operator",
  {},
  { provider: k8sProvider }
);

const bucket = new aws.s3.BucketV2("spinnaker", {})

const bucketAllowPolicy = new aws.iam.RolePolicy("spinnaker-s3", {
    role: role,
    policy: {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "Spinnaker",
                Effect: "Allow",
                Action: "s3:*",
                Resource:[
                    bucket.arn,
                    pulumi.interpolate`${bucket.arn}/*`
                  ]
            },
        ],
      } as aws.iam.PolicyDocument
}, { parent: role })


export const bucketName = bucket.bucket

const customResource = new k8s.apiextensions.CustomResource("spinnaker", {
  apiVersion: "spinnaker.io/v1alpha2",
  kind: "SpinnakerService",
  metadata: {
    namespace: operatorDeployment.namespace.metadata.name,
  },
  expose: {
    type: "service",
    service: {
      type: "LoadBalancer",
    },
  },
  spinnakerConfig: {
    config: {
      version: "1.17.1",
      persistentStorage: {
        persistentStoreType: "s3",
        s3: {
          bucket: bucket.bucket,
          rootFolder: "root50",
        },
      },
    },
  },
}, { provider: k8sProvider });

export const kubeconfig = cluster.kubeconfig;
