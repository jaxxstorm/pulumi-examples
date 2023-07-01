import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const vpc = new awsx.ec2.Vpc("aurora-major-version-upgrade");

const subnetGroup = new aws.rds.SubnetGroup("aurora-major-version-upgrade", {
  subnetIds: vpc.privateSubnetIds,
});

const pg = new aws.rds.ParameterGroup("aurora-major-version-upgrade", {
  family: "aurora-postgresql14",
});

// this instantiation of the database uses the default parameter group
// const cluster = new aws.rds.Cluster("aurora-major-version-upgrade", {
//   backupRetentionPeriod: 1,
//   databaseName: "example",
//   engine: "aurora-postgresql",
//   masterUsername: "example",
//   engineVersion: "13.10",
//   allowMajorVersionUpgrade: true,
//   // dbClusterParameterGroupName: pg.name,
//   masterPassword: "correct-horse-battery-stable",
//   skipFinalSnapshot: true,
// });

// here, we use an explicitly built parameter group
const cluster = new aws.rds.Cluster("aurora-major-version-upgrade", {
  backupRetentionPeriod: 1,
  databaseName: "example",
  engine: "aurora-postgresql",
  masterUsername: "example",
  engineVersion: "14.7", // then modify this
  allowMajorVersionUpgrade: true,
  dbClusterParameterGroupName: pg.name, // make sure this gets added first, run a successful up
  masterPassword: "correct-horse-battery-stable",
  skipFinalSnapshot: true,
});

export const clusterName = cluster.clusterIdentifier;
