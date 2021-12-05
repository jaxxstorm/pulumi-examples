import * as azure from "@pulumi/azure";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as tls from "@pulumi/tls";

export interface PlatformClusterArgs {
  defaultNodeCount?: pulumi.Input<number>;
  defaultNodeSize?: pulumi.Input<string>;
  adminGroupObjectId: pulumi.Input<string>;
}

export class PlatformCluster extends pulumi.ComponentResource {
  resourceGroup: azure.core.ResourceGroup;
  identity: azure.authorization.UserAssignedIdentity;
  cluster: azure.containerservice.KubernetesCluster;
  sshKey: tls.PrivateKey;
  k8sProvider: k8s.Provider;
  operatorRole: azure.authorization.Assignment;
  contributorRole: azure.authorization.Assignment;
  aad: k8s.helm.v3.Release;
  csi: k8s.helm.v3.Release;
  // nginx: k8s.helm.v3.Release;
  // aksIdentity: aksidentity.AKSIdentity;
  nodeResourceGroup: pulumi.Output<azure.core.GetResourceGroupResult>;

  private readonly name: string;

  constructor(
    name: string,
    args: PlatformClusterArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:PlatformCluster", name, {}, opts);

    this.name = name;

    // define a distinct resource group for the cluster
    this.resourceGroup = new azure.core.ResourceGroup(
      name,
      {},
      { parent: this }
    );

    // create a user assigned identity for the cluster so we can assign scoped permissions
    this.identity = new azure.authorization.UserAssignedIdentity(
      name,
      {
        resourceGroupName: this.resourceGroup.name,
      },
      { parent: this.resourceGroup }
    );

    // define an SSH key to access the nodes if needed
    this.sshKey = new tls.PrivateKey(
      `${name}-key`,
      {
        algorithm: "RSA",
        rsaBits: 4096,
      },
      { parent: this }
    );

    // create a Kubernetes cluster
    this.cluster = new azure.containerservice.KubernetesCluster(
      name,
      {
        resourceGroupName: this.resourceGroup.name,
        defaultNodePool: {
          name: "aksagentpool",
          nodeCount: args.defaultNodeCount || 2,
          vmSize: args.defaultNodeSize || "Standard_D2_v2",
        },
        dnsPrefix: `${pulumi.getStack()}-kube`,
        linuxProfile: {
          adminUsername: "aksuser",
          sshKey: {
            keyData: this.sshKey.publicKeyOpenssh,
          },
        },
        roleBasedAccessControl: {
          enabled: true,
          azureActiveDirectory: {
            managed: true,
            azureRbacEnabled: true,
            adminGroupObjectIds: [args.adminGroupObjectId],
          },
        },
        identity: {
          type: "UserAssigned",
          userAssignedIdentityId: this.identity.id,
        },
      },
      { parent: this.resourceGroup }
    );

    // define a provider for installing kubernetes objects
    this.k8sProvider = new k8s.Provider(
      name,
      {
        kubeconfig: this.cluster.kubeAdminConfigRaw,
      },
      { parent: this.cluster }
    );

    // set an AD group as cluster admin
    const clusterAdmin = new azure.authorization.Assignment(
      `${name}-admin`,
      {
        principalId: args.adminGroupObjectId,
        scope: this.cluster.id,
        roleDefinitionName: "Azure Kubernetes Service RBAC Cluster Admin",
      },
      { parent: this.cluster }
    );

    // retrieve the node resource group for use assigning auth
    this.nodeResourceGroup = azure.core.getResourceGroupOutput(
      {
        name: this.cluster.nodeResourceGroup,
      },
      { parent: this }
    );

    // allows the AAD and secrets driver to work
    this.operatorRole = new azure.authorization.Assignment(
      `${name}-operator`,
      {
        roleDefinitionName: "Managed Identity Operator",
        principalId: this.cluster.kubeletIdentities[0].objectId,
        scope: this.nodeResourceGroup.id,
      },
      { parent: this.resourceGroup }
    );

    // allows the AAD and secrets driver to work
    this.contributorRole = new azure.authorization.Assignment(
      `${name}-contributor`,
      {
        roleDefinitionName: "Virtual Machine Contributor",
        principalId: this.cluster.kubeletIdentities[0].objectId,
        scope: this.nodeResourceGroup.id,
      },
      { parent: this.resourceGroup }
    );

    // installs the azure active directory pod identity deployment
    this.aad = new k8s.helm.v3.Release(
      `${name}-aad`,
      {
        name: "aad-pod-identity",
        chart: "aad-pod-identity",
        namespace: "kube-system",
        repositoryOpts: {
          repo: "https://raw.githubusercontent.com/Azure/aad-pod-identity/master/charts",
        },
        values: {
          nmi: {
            allowNetworkPluginKubenet: true,
          },
        },
      },
      { provider: this.k8sProvider, parent: this }
    );

    // installs the secrets store provider driver
    this.csi = new k8s.helm.v3.Release(
      `${name}-csi`,
      {
        name: "csi-secrets-store-provider-azure",
        chart: "csi-secrets-store-provider-azure",
        namespace: "kube-system",
        repositoryOpts: {
          repo: "https://raw.githubusercontent.com/Azure/secrets-store-csi-driver-provider-azure/master/charts",
        },
        values: {
          "secrets-store-csi-driver": {
            syncSecret: {
              enabled: "true",
            },
          },
        },
      },
      { provider: this.k8sProvider, parent: this }
    );

    this.registerOutputs({})
  }
}
