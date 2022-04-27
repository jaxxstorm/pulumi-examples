import * as pulumi from "@pulumi/pulumi";
import * as cluster from "./encryptedcluster";

const eks = new cluster.EncryptedCluster("example", {
    maxNodes: 5
})
