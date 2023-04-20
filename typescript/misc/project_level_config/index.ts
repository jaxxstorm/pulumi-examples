import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config()
const awsconfig = new pulumi.Config("aws")

export const foo = config.require("foo")
export const region = awsconfig.require("region")
