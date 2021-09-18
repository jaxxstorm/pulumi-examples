import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as webapp from "./webapp";

const app = new webapp.FargateWebApp("example", {
    imagePath: "./app"
})

export const url = app.url