import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const kmsKey = new aws.kms.Key("config", { deletionWindowInDays: 7, enableKeyRotation: true });
new aws.kms.Alias("config", { name: `alias/foo`, targetKeyId: kmsKey.id });
