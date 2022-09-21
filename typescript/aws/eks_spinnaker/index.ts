import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as operator from "./operator";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const pubKey = config.require("publicKey");

const role = new aws.iam.Role("spinnaker", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ec2.amazonaws.com",
  }),
});

const managedPolicyArns: string[] = [
  "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
  "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
];

managedPolicyArns.forEach((policy, index) => {
  new aws.iam.RolePolicyAttachment(`spinnaker-workernode-policy-${index}`, {
    policyArn: policy,
    role: role,
  });
});

// create an EKS cluster
const cluster = new eks.Cluster("spinnaker", {
  minSize: 1,
  desiredCapacity: 3,
  maxSize: 5,
  instanceType: "t3.2xlarge",
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
      "crds/spinnaker.io_spinnakeraccounts_crd.yaml",
      "crds/spinnaker.io_spinnakerservices_crd.yaml",
    ],
  },
  { provider: k8sProvider }
);

const operatorDeployment = new operator.SpinnakerOperator(
  "spinnaker-operator",
  {},
  { provider: k8sProvider }
);

const bucket = new aws.s3.BucketV2("spinnaker", {});

const bucketAllowPolicy = new aws.iam.RolePolicy(
  "spinnaker-s3",
  {
    role: role,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "Spinnaker",
          Effect: "Allow",
          Action: "s3:*",
          Resource: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
        },
      ],
    } as aws.iam.PolicyDocument,
  },
  { parent: role }
);

export const bucketName = bucket.bucket;

const ns = new k8s.core.v1.Namespace("spinnaker", {
  metadata: {
    name: "spinnaker",
  },
}, { provider: k8sProvider});

const sa = new k8s.core.v1.ServiceAccount("spinnaker", {
  metadata: {
    namespace: ns.metadata.name,
  },
}, { provider: k8sProvider });

const roleBinding = new k8s.rbac.v1.ClusterRoleBinding("spinnaker", {
  metadata: {
    namespace: ns.metadata.name,
    labels: {
      name: "spinnaker-deploy",
    },
  },
  subjects: [
    {
      kind: "ServiceAccount",
      name: sa.metadata.name,
      namespace: ns.metadata.name,
    },
  ],
  roleRef: {
    kind: "ClusterRole",
    name: "cluster-admin", // FIXME: permissive
    apiGroup: "rbac.authorization.k8s.io",
  },
}, { provider: k8sProvider });

// let spinnakerKubeConfig = pulumi.all([cluster.eksCluster.endpoint, cluster.eksCluster.certificateAuthority, sa.secrets.])

const customResource = new k8s.apiextensions.CustomResource(
  "spinnaker",
  {
    apiVersion: "spinnaker.io/v1alpha2",
    kind: "SpinnakerService",
    metadata: {
      namespace: ns.metadata.name,
    },
    spec: {
      expose: {
        type: "service",
        service: {
          type: "LoadBalancer",
        },
      },
      spinnakerConfig: {
        config: {
          version: "1.27.1",
          persistentStorage: {
            persistentStoreType: "s3",
            s3: {
              bucket: bucket.bucket,
              rootFolder: "root50",
            },
          },
        //   providers: {
        //     kubernetes: {
        //       enabled: true,
        //       accounts: [
        //         {
        //           name: "example",
        //           providerVersion: "V2",
        //           serviceAccount: sa.metadata.name,
        //           onlySpinnakerManaged: true,
        //           requiredGroupMembership: [],
        //           permissions: {},
        //           dockerRegistries: [],
        //           configureImagePullSecrets: true,
        //           cacheThreads: 1,
        //           namespaces: [],
        //           omitNamespaces: [],
        //           kinds: [],
        //           omitKinds: [],
        //           customResources: [],
        //           cachingPolicies: [],
        //           oAuthScopes: [],
        //         },
        //       ],
        //       primaryAccount: "example",
        //     },
        //   },
        },
      },
    },
  },
  { provider: k8sProvider, parent: ns }
);

export const kubeconfig = cluster.kubeconfig;
