import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface IngressCanaryArgs {}

export class IngressCanary extends pulumi.ComponentResource {
  
    private readonly name: string;
  
    constructor(
      name: string,
      args: IngressCanaryArgs,
      opts?: pulumi.ComponentResourceOptions
    ) {
      super("jaxxstorm:index:IngressCanary", name, {}, opts);
  
      this.name = name;
    }
}