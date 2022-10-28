import * as pulumi from "@pulumi/pulumi";
import * as network from "@pulumi/azure-native/network";
import * as resources from "@pulumi/azure-native/resources";
import * as compute from "@pulumi/azure-native/compute";
import * as azure from "@pulumi/azure";

// Create an Azure Resource Group
const resourceGroup = new resources.ResourceGroup("tailscale");

export const resourceGroupName = resourceGroup.name

const config = new pulumi.Config();

const key = config.requireSecret("tailscaleKey");

const virtualNetwork = new network.VirtualNetwork(
  "tailscale",
  {
    resourceGroupName: resourceGroup.name,
    addressSpace: { addressPrefixes: ["172.16.0.0/22"] },
  },
  { parent: resourceGroup }
);

const subnet = new network.Subnet(
  "tailscale",
  {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: virtualNetwork.name,
    addressPrefix: "172.16.0.0/24",
  },
  { parent: virtualNetwork }
);

export const subnetName = subnet.name
export const virtualNetworkName = virtualNetwork.name

const initScript = key.apply((key) =>
  Buffer.from(
    `#!/bin/bash\n
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list
curl -sL https://packages.microsoft.com/keys/microsoft.asc |
    gpg --dearmor |
    sudo tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null
AZ_REPO=$(lsb_release -cs)
echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" |
    sudo tee /etc/apt/sources.list.d/azure-cli.list
sudo apt-get update
sudo apt-get install azure-cli tailscale
tailscale up --advertise-routes=172.16.0.0/22 --authkey=${key} --accept-dns=false`
  ).toString("base64")
);

const virtualMachineScaleSet = new compute.VirtualMachineScaleSet(
  "virtualMachineScaleSet",
  {
    resourceGroupName: resourceGroup.name,
    sku: {
      capacity: 1,
      name: "Standard_B1s",
      tier: "Standard",
    },
    //vmScaleSetName: "tailscale",
    upgradePolicy: {
      mode: compute.UpgradeMode.Manual,
    },
    identity: {
      type: compute.ResourceIdentityType.SystemAssigned,
    },
    virtualMachineProfile: {
      userData: initScript,
      storageProfile: {
        imageReference: {
          publisher: "Canonical",
          offer: "0001-com-ubuntu-server-focal",
          sku: "20_04-lts-gen2",
          version: "latest",
        },
      },
      osProfile: {
        adminPassword: "correctHorsebatterystab1e",
        adminUsername: "tailscale",
        computerNamePrefix: "tailscale",
      },
      networkProfile: {
        networkInterfaceConfigurations: [
          {
            enableIPForwarding: true,
            ipConfigurations: [
              {
                name: "tailscale",
                subnet: {
                  id: subnet.id,
                },
              },
            ],
            name: "tailscale",
            primary: true,
          },
        ],
      },
    },
  }
);

