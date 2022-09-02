import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as operator from "./operator";
import * as aws from "@pulumi/aws";

// create an EKS cluster
const cluster = new eks.Cluster("spinnaker", {
  minSize: 1,
  desiredCapacity: 2,
  maxSize: 5,
  instanceType: "t3.medium",
  version: "1.21", // FIXME: need to transform CRDs if using a newer eks version
});

const k8sProvider = new k8s.Provider("spinnaker", {
  enableServerSideApply: true,
  kubeconfig: cluster.kubeconfig,
});

const crds = new k8s.yaml.ConfigGroup(
  "spinnaker",
  {
    files: [
      "https://raw.githubusercontent.com/armory/spinnaker-operator/0eb9030d113e0090b2a39f36462fcfa32dd02e27/deploy/crds/spinnaker.io_spinnakeraccounts_crd.yaml",
      "https://raw.githubusercontent.com/armory/spinnaker-operator/0eb9030d113e0090b2a39f36462fcfa32dd02e27/deploy/crds/spinnaker.io_spinnakerservices_crd.yaml",
    ],
  },
  { provider: k8sProvider }
);

const bucket = new aws.s3.Bucket("spinnaker", {});

const iamUser = new aws.iam.User("spinnaker", {});

const iamUserPolicy = new aws.iam.UserPolicy("spinnaker", {
    user: iamUser.name,
    policy: {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "Spinnaker",
                Effect: "Allow",
                Action: "s3:*",
                Resource: [
                    bucket.arn,
                    pulumi.interpolate`${bucket.arn}/*`,
                ]
            },
        ],
      } as aws.iam.PolicyDocument
})

const ns = new k8s.core.v1.Namespace("spinnaker-system", {
    metadata: {
        name: "spinnaker-system"
    }
})

const sa = new k8s.core.v1.ServiceAccount("spinnaker", {
    metadata: {
        namespace: ns.metadata.name
    }
})

export const serviceAccountName = sa.metadata.name
export const bucketName = bucket.bucket

// const operatorDeployment = new operator.SpinnakerOperator(
//   "spinnaker-operator",
//   {},
//   { provider: k8sProvider }
// );


// const deployment = new spinnaker.spinnaker.v1alpha2.SpinnakerService("spinnaker", {
//     metadata: {
//         namespace: operatorDeployment.namespace.metadata.name
//     },
//     spec: {
//         expose: {
//             type: "service",
//             service: {
//                 type: "LoadBalancer"
//             }
//         },
//         spinnakerConfig: {
//             config: {
//                 version: "1.26.6",
//                 persistentStorage: {
//                     persistentStoreType: "s3",
//                     s3: {
//                         bucket: bucket.bucket,
//                         rootFolder: "root50",
//                     },
//                 }
//             }
//         }
//     }
// }, { provider: k8sProvider})

// const customResource = new k8s.apiextensions.CustomResource("spinnaker", {
//   apiVersion: "spinnaker.io/v1alpha2",
//   kind: "SpinnakerService",
//   metadata: {
//     namespace: operatorDeployment.namespace.metadata.name,
//   },
//   expose: {
//     type: "service",
//     service: {
//       type: "LoadBalancer",
//     },
//   },
//   spinnakerConfig: {
//     config: {
//       version: "1.17.1",
//       persistentStorage: {
//         persistentStoreType: "s3",
//         s3: {
//           bucket: bucket.bucket,
//           rootFolder: "root50",
//         },
//       },
//     },
//   },
// }, { provider: k8sProvider });

export const kubeconfig = cluster.kubeconfig;
