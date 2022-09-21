import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as pulumicdk from '@pulumi/cdk';
import * as redshift from 'aws-cdk-lib/aws-redshiftserverless';

class RedshiftStack extends pulumicdk.Stack {

    constructor(id: string, options?: pulumicdk.StackOptions) {
        super(id, options);

        const namespace = new aws.redshiftserverless.Namespace("namespace", {
            namespaceName: "lbriggs",
        })

        const workgroup = new redshift.CfnWorkgroup(this, 'workgroup', {
            workgroupName: "workgroup",
            namespaceName: "lbriggs",
        })

        this.synth();


    }
}

const stack = new RedshiftStack('teststack');
