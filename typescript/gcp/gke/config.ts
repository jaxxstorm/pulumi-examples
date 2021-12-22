import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

const gcloudConfig = new pulumi.Config("google-native");
export const project = gcloudConfig.require("project");
export const region = gcloudConfig.require("region");