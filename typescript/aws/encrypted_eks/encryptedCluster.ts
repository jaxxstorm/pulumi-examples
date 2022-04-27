import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";


export interface EncryptedClusterArgs {
    maxNodes: pulumi.Input<number>;
}

export class EncryptedCluster extends pulumi.ComponentResource {
    kmsKey: aws.kms.Key
    cluster: eks.Cluster


    constructor(name: string, args: EncryptedClusterArgs, opts?: pulumi.ComponentResourceOptions) {
        super("jaxxstorm:index:encryptedCluster", name, {}, opts);

        this.kmsKey = new aws.kms.Key(name, {},{ parent: this })

        this.cluster = new eks.Cluster(name, {
            encryptionConfigKeyArn: this.kmsKey.arn,
            maxSize: args.maxNodes
        }, { parent: this })

        this.registerOutputs({});
    }

    
}