import * as platformcluster from "./platformcluster";
import * as kv from "./certificate";
import * as azure from "@pulumi/azure";
import * as aksidentity from "./aksidentity";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const adminGroupObjectId = config.require("adminGroupObjectId");

/*
 * creates a cluster with:
 * - a user assigned identity
 * - a generated ssh key for node access
 * - the required role assignments to assign an AD group admin access
 * - the correct role assignments for AAD to work
 * - aad installed
 * - the csi secrets driver installed
 */ 
const k8sCluster = new platformcluster.PlatformCluster("lbriggs", {
  adminGroupObjectId: adminGroupObjectId,
});

// defines the identity object for AKS to sync to a pod
const aksIdentity = new aksidentity.AKSIdentity(
  "lbriggs",
  {
    resourceGroupName: k8sCluster.nodeResourceGroup.name,
  },
  {
    providers: {
      kubernetes: k8sCluster.k8sProvider,
    },
  }
);

const current = azure.core.getClientConfig({});

// define a certificate inside keyvault
const cert = new kv.KeyVaultCertificate("example", {
  clientConfig: current,
  dnsNames: ["web.lbrlabs.com"],
  commonName: "created-by-pulumi",
  keyVaultIdentityId: aksIdentity.identity.principalId,
});


// create a secret provider class which syncs the cert to pods/secrets
const secret = new k8s.apiextensions.CustomResource("cert", {
    apiVersion: "secrets-store.csi.x-k8s.io/v1",
    kind: "SecretProviderClass",
    metadata: {
        namespace: "kube-system",
    },
    spec: {
        provider: "azure",
        secretObjects: [{
            data: [{
                objectName: cert.certificate.name,
                key: "tls.key",
            }, {
                objectName: cert.certificate.name,
                key: "tls.crt"
            }],
            secretName: "ingress-tls-csi",
            type: "kubernetes.io/tls",
        }],
        parameters: {
            usePodIdentity: "true",
            keyvaultName: cert.keyvault.name,
            objects: pulumi.interpolate`array:\n  - |\n    objectName: ${cert.certificate.name}\n    objectType: secret\n`,
            tenantId: current.then(config => config.tenantId),
        }
    }
}, { provider: k8sCluster.k8sProvider })

// install nginx-ingress
const nginx = new k8s.helm.v3.Release(
  "nginx",
  {
    // name: "nginx",
    chart: "ingress-nginx",
    namespace: "kube-system",
    repositoryOpts: {
      repo: "https://kubernetes.github.io/ingress-nginx",
    },
    values: {
      controller: {
        extraArgs: {
            "default-ssl-certificate": "kube-system/ingress-tls-csi"    
        },  
        podLabels: {
            aadpodidbinding: aksIdentity.azureIdentity.metadata.name,
        },
        extraVolumes: [{
            name: "secrets-store-inline",
            csi: {
                driver: "secrets-store.csi.k8s.io",
                readOnly: true,
                volumeAttributes: {
                    secretProviderClass: secret.metadata.name
                },
            }
        }],
        extraVolumeMounts: [
            {
                name: "secrets-store-inline",
                mountPath: "/mnt/secrets-store",
                readOnly: true,
            }
        ]
      },
    },
  },
  { provider: k8sCluster.k8sProvider }
);

export let cluster = k8sCluster.cluster.name;
export let kubeConfig = k8sCluster.cluster.kubeAdminConfigRaw;
// export let identityName = aksIdentity.azureIdentity.metadata.name;
// export let identityId = aksIdentity.identity.clientId;
// export let identityResourceGroup = k8sCluster.nodeResourceGroup.id;
