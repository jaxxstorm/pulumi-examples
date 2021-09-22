import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const exampleCluster = aws.eks.getCluster({
    name: "lbriggs-eksCluster-04570ef",
});
const exampleClusterAuth = aws.eks.getClusterAuth({
    name: "lbriggs-eksCluster-04570ef",
});
export const clusterId = exampleClusterAuth.then(exampleClusterAuth => exampleClusterAuth.id);
export const clusterToken = exampleClusterAuth.then(exampleClusterAuth => exampleClusterAuth.token);
