import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as fs from "fs";

// this interface defines your arguments for your component
export interface KeyVaultCertificateArgs {
  clientConfig: Promise<azure.core.GetClientConfigResult>;
  dnsNames: pulumi.Input<pulumi.Input<string>[]>;
  commonName: string;
  keyVaultIdentityId: pulumi.Input<string>;
}

export class KeyVaultCertificate extends pulumi.ComponentResource {
  keyvault: azure.keyvault.KeyVault;
  certificate: azure.keyvault.Certificate;
  resourceGroup: azure.core.ResourceGroup;
  role: azure.authorization.Assignment;
  policy: azure.keyvault.AccessPolicy;

  private readonly name: string;

  constructor(
    name: string,
    args: KeyVaultCertificateArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("jaxxstorm:index:KeyVaultCertificate", name, {}, opts);

    this.name = name;

    this.resourceGroup = new azure.core.ResourceGroup(name, {}, { parent: this });

    this.keyvault = new azure.keyvault.KeyVault(
      name,
      {
        resourceGroupName: this.resourceGroup.name,
        tenantId: args.clientConfig.then((current) => current.tenantId),
        skuName: "standard",
        softDeleteRetentionDays: 7,
        accessPolicies: [
          {
            tenantId: args.clientConfig.then((current) => current.tenantId),
            objectId: args.clientConfig.then((current) => current.objectId),
            certificatePermissions: [
              "create",
              "delete",
              "deleteissuers",
              "get",
              "getissuers",
              "import",
              "list",
              "listissuers",
              "managecontacts",
              "manageissuers",
              "purge",
              "setissuers",
              "update",
            ],
            keyPermissions: [
              "backup",
              "create",
              "decrypt",
              "delete",
              "encrypt",
              "get",
              "import",
              "list",
              "purge",
              "recover",
              "restore",
              "sign",
              "unwrapKey",
              "update",
              "verify",
              "wrapKey",
            ],
            secretPermissions: [
              "backup",
              "delete",
              "get",
              "list",
              "purge",
              "recover",
              "restore",
              "set",
            ],
          },
        ],
      },
      { parent: this.resourceGroup }
    );

    this.certificate = new azure.keyvault.Certificate(name, {
      keyVaultId: this.keyvault.id,
      certificatePolicy: {
        issuerParameters: {
          name: "Self",
        },
        keyProperties: {
          exportable: true,
          keySize: 2048,
          keyType: "RSA",
          reuseKey: true,
        },
        lifetimeActions: [
          {
            action: {
              actionType: "AutoRenew",
            },
            trigger: {
              daysBeforeExpiry: 30,
            },
          },
        ],
        secretProperties: {
          contentType: "application/x-pkcs12",
        },
        x509CertificateProperties: {
          extendedKeyUsages: ["1.3.6.1.5.5.7.3.1"],
          keyUsages: [
            "cRLSign",
            "dataEncipherment",
            "digitalSignature",
            "keyAgreement",
            "keyCertSign",
            "keyEncipherment",
          ],
          subjectAlternativeNames: {
            dnsNames: args.dnsNames,
          },
          subject: `CN=${args.commonName}`,
          validityInMonths: 12,
        },
      },
    }, { parent: this.keyvault });

    this.role = new azure.authorization.Assignment(name, {
      scope: this.keyvault.id,
      roleDefinitionName: "Reader",
      principalId: args.keyVaultIdentityId,
    })

    this.policy = new azure.keyvault.AccessPolicy(name, {
      keyVaultId: this.keyvault.id,
      tenantId: args.clientConfig.then((current) => current.tenantId),
      objectId: args.keyVaultIdentityId,
      keyPermissions: [
        "Get", "List"
      ],
      secretPermissions: [
        "Get", "List"
      ]
    }, { parent: this.keyvault })

    this.registerOutputs({})
  }
}
