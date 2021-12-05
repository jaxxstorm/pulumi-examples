import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as k8s from "@pulumi/kubernetes";
import * as aksidentity from "./aksidentity";

// this interface defines your arguments for your component
export interface AKSIdentityArgs {
  resourceGroupName: pulumi.Input<string>;
}

export class AKSIdentity extends pulumi.ComponentResource {
  identity: azure.authorization.UserAssignedIdentity;
  azureIdentity: k8s.apiextensions.CustomResource;
  azureIdentityBinding: k8s.apiextensions.CustomResource;

  private readonly name: string;

  constructor(
    name: string,
    args: AKSIdentityArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:AKSIdentity", name, {}, opts);

    this.name = name;

    this.identity = new azure.authorization.UserAssignedIdentity(
      name,
      {
        resourceGroupName: args.resourceGroupName,
      },
      { parent: this }
    );

    this.azureIdentity = new k8s.apiextensions.CustomResource(
      name,
      {
        apiVersion: "aadpodidentity.k8s.io/v1",
        kind: "AzureIdentity",
        metadata: {
          name: this.identity.name,
          namespace: "kube-system"
        },
        spec: {
          type: 0,
          resourceID: this.identity.id,
          clientID: this.identity.clientId,
        },
      },
      { parent: this }
    );

    this.azureIdentityBinding = new k8s.apiextensions.CustomResource(
      name,
      {
        apiVersion: "aadpodidentity.k8s.io/v1",
        kind: "AzureIdentityBinding",
        metadata: {
          name: this.identity.name,
          namespace: "kube-system"
        },
        spec: {
          azureIdentity: this.identity.name,
          selector: this.identity.name,
        },
      },
      { parent: this }
    );

    this.registerOutputs({})

  }
}
