import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";
import * as azuread from "@pulumi/azuread";
import * as k8s from "@pulumi/kubernetes";

// Parse and export configuration variables for this stack.
const config = new pulumi.Config();
export const password = config.require("password");
export const location = config.get("location") || azure.Locations.EastUS;
export const nodeCount = config.getNumber("nodeCount") || 2;
export const nodeSize = config.get("nodeSize") || "Standard_D2_v2";
export const sshPublicKey = config.require("sshPublicKey");
export const resourceGroup = new azure.core.ResourceGroup("aks-example", { location });

// Create the AD service principal for the K8s cluster.
const adApp = new azuread.Application("aks");
const adSp = new azuread.ServicePrincipal("aksSp", { applicationId: adApp.applicationId });
const adSpPassword = new azuread.ServicePrincipalPassword("aksSpPassword", {
    servicePrincipalId: adSp.id,
    value: password,
    endDate: "2099-01-01T00:00:00Z",
});

// Now allocate an AKS cluster.
export const k8sCluster = new azure.containerservice.KubernetesCluster("aksCluster", {
    resourceGroupName: resourceGroup.name,
    location: location,
    defaultNodePool: {
        name: "aksagentpool",
        nodeCount: nodeCount,
        vmSize: nodeSize,
    },
    dnsPrefix: `${pulumi.getStack()}-kube`,
    linuxProfile: {
        adminUsername: "aksuser",
        sshKey: {
            keyData: sshPublicKey,
        },
    },
    servicePrincipal: {
        clientId: adApp.applicationId,
        clientSecret: adSpPassword.value,
    },
});

// Expose a K8s provider instance using our custom cluster instance.
export const k8sProvider = new k8s.Provider("aksK8s", {
    kubeconfig: k8sCluster.kubeConfigRaw,
});
