package main

import (
	"fmt"
	compute "github.com/pulumi/pulumi-azure-native/sdk/go/azure/compute"
	network "github.com/pulumi/pulumi-azure-native/sdk/go/azure/network"
	resources "github.com/pulumi/pulumi-azure-native/sdk/go/azure/resources"
	"github.com/pulumi/pulumi-terraform/sdk/v5/go/state"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		conf := config.New(ctx, "")
		token := conf.RequireSecret("tfeToken")
		organization := conf.Require("organization")
		workspace := conf.Require("workspaceName")
		adminPassword := conf.Require("adminPassword")

		// grab the remote state reference from terraform cloud
		state, err := state.NewRemoteStateReference(ctx, "remote-backend-state", &state.RemoteBackendStateArgs{
			Organization: pulumi.String(organization),
			Token:        pulumi.StringPtrInput(token.ToStringPtrOutput()),
			Workspaces: state.WorkspaceStateArgs{
				Name: pulumi.String(workspace),
			},
		})
		if err != nil {
			return err
		}

		// retrieve the outputs from the remote state
		vnetId := state.Outputs.MapIndex(pulumi.String("vnet_id"))
		subnetId := state.Outputs.MapIndex(pulumi.String("vnet_subnet"))

		// export the outputs on the CLI so we can view them
		ctx.Export("vnet_id", vnetId)
		ctx.Export("subnet_id", subnetId)

		// create a resource group
		rg, err := resources.NewResourceGroup(ctx, "resourceGroup", &resources.ResourceGroupArgs{
			Location: pulumi.String("westus2"),
		})
		if err != nil {
			return fmt.Errorf("error creating resource group: %v", err)
		}

		// create a public IP address
		ip, err := network.NewPublicIPAddress(ctx, "publicIP", &network.PublicIPAddressArgs{
			ResourceGroupName:        rg.Name,
			PublicIPAllocationMethod: pulumi.String(network.IPAllocationMethodDynamic),
		})
		if err != nil {
			return fmt.Errorf("error creating public ip address: %v", err)
		}

		// the subnet id is a pulumi output, so we need to convert it to a StringOutput
		subnet := subnetId.ApplyT(func(v interface{}) string {
			return v.(string)
		}).(pulumi.StringOutput)

		// create a network interface
		nic, err := network.NewNetworkInterface(ctx, "nic", &network.NetworkInterfaceArgs{
			ResourceGroupName: rg.Name,
			IpConfigurations: network.NetworkInterfaceIPConfigurationArray{
				&network.NetworkInterfaceIPConfigurationArgs{
					Name:                      pulumi.String("webserver"),
					PrivateIPAllocationMethod: pulumi.String(network.IPAllocationMethodDynamic),
					PublicIPAddress: network.PublicIPAddressTypeArgs{
						Id: ip.ID(),
					},
					Subnet: network.SubnetTypeArgs{
						Id: subnet.ToStringPtrOutput(),
					},
				},
			},
		})
		if err != nil {
			return fmt.Errorf("error creating network interface group: %v", err)
		}

		// create a virtual machine
		vm, err := compute.NewVirtualMachine(ctx, "vm", &compute.VirtualMachineArgs{
			ResourceGroupName: rg.Name,
			NetworkProfile: compute.NetworkProfileArgs{
				NetworkInterfaces: compute.NetworkInterfaceReferenceArray{
					&compute.NetworkInterfaceReferenceArgs{
						Id: nic.ID(),
					},
				},
			},
			HardwareProfile: compute.HardwareProfileArgs{
				VmSize: pulumi.String(compute.VirtualMachineSizeTypes_Basic_A0),
			},
			OsProfile: compute.OSProfileArgs{
				AdminUsername: pulumi.String("lbriggs"),
				ComputerName:  pulumi.String("webserver"),
				AdminPassword: pulumi.String(adminPassword),
				CustomData:    pulumi.String(""),
				LinuxConfiguration: compute.LinuxConfigurationArgs{
					DisablePasswordAuthentication: pulumi.Bool(false),
				},
			},
			StorageProfile: compute.StorageProfileArgs{
				OsDisk: compute.OSDiskArgs{
					CreateOption: pulumi.String(compute.DiskCreateOptionTypesFromImage),
					Name:         pulumi.String("webserver"),
				},
				ImageReference: compute.ImageReferenceArgs{
					Publisher: pulumi.String("Canonical"),
					Offer:     pulumi.String("UbuntuServer"),
					Sku:       pulumi.String("18.04-LTS"),
					Version:   pulumi.String("latest"),
				},
			},
		})
		if err != nil {
			return fmt.Errorf("error creating virtual machine: %v", err)
		}

		/* we want the public IP of the VM
		 * but it isn't returned immediately by the Azure API
		 * we we use an `ApplyT` callback which will lookup the IP and poll until it is available
		 */
		ipAddress := vm.ID().ApplyT(func(i interface{}) pulumi.StringPtrOutput {
			value := network.LookupPublicIPAddressOutput(ctx, network.LookupPublicIPAddressOutputArgs{
				PublicIpAddressName: ip.Name,
				ResourceGroupName:   rg.Name,
			})
			return value.IpAddress()
		})

		ctx.Export("ipAddress", ipAddress)

		return nil

	})

}
