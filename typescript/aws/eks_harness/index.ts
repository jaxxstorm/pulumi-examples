import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import * as delegate from "./delegate";
import * as harness from "@lbrlabs/pulumi-harness";

const config = new pulumi.Config()
const harnessConfig = new pulumi.Config("harness")
const delegateToken = config.require("delegateToken")
const accountId = config.require("accountId")


// // create an EKS cluster
const cluster = new eks.Cluster("harness", {
  minSize: 1,
  desiredCapacity: 3,
  maxSize: 5,
  instanceType: "t3.2xlarge",
});

const k8sProvider = new k8s.Provider("harness", {
  enableServerSideApply: true,
  kubeconfig: cluster.kubeconfig,
});

// install a global delegate
const accountDelegate = new delegate.HarnessDelegate("lbrlabs", {
  delegateToken: delegateToken,
  accountId: accountId,
}, { provider: k8sProvider })

// retrieve my harness org
const org = harness.platform.getOrganizationOutput({
  name: "default",
});


// define a harness project
const project = new harness.platform.Project("pulumi", {
  identifier: "pulumi",
  orgId: org.id,
});

// define a harness service
const svc = new harness.platform.Service("pulumi", {
  identifier: "nginx",
  projectId: project.id,
  orgId: org.id,
});

export const orgId = org.id
export const projectId = project.id


