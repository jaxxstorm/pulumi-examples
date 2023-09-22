package main

import (
	"github.com/pulumi/pulumi-azure-native-sdk/managedidentity/v2"
	"github.com/pulumi/pulumi-azure-native-sdk/network/v2"
	"github.com/pulumi/pulumi-azure-native-sdk/resources/v2"
	classicNetwork "github.com/pulumi/pulumi-azure/sdk/v5/go/azure/network"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// Create an Azure Resource Group
		resourceGroup, err := resources.NewResourceGroup(ctx, "lbriggs", nil)
		if err != nil {
			return err
		}

		identity, err := managedidentity.NewUserAssignedIdentity(ctx, "userAssignedIdentity", &managedidentity.UserAssignedIdentityArgs{
			ResourceGroupName: resourceGroup.Name,
		})

		vnet, err := network.NewVirtualNetwork(ctx, "lbriggs", &network.VirtualNetworkArgs{
			ResourceGroupName: resourceGroup.Name,
			AddressSpace: &network.AddressSpaceArgs{
				AddressPrefixes: pulumi.StringArray{
					pulumi.String("10.0.0.0/16"),
				},
			},
			Subnets: network.SubnetTypeArray{
				&network.SubnetTypeArgs{
					AddressPrefix: pulumi.String("10.0.0.0/24"),
					Name:          pulumi.String("default"),
				},
				&network.SubnetTypeArgs{
					Name:          pulumi.String("appgwsubnet"),
					AddressPrefix: pulumi.String("10.0.1.0/24"),
				},
			},
		}, pulumi.Parent(resourceGroup))
		if err != nil {
			return err
		}

		publicIp, err := network.NewPublicIPAddress(ctx, "lbriggs", &network.PublicIPAddressArgs{
			ResourceGroupName:        resourceGroup.Name,
			PublicIPAllocationMethod: pulumi.String("Static"),
			Sku: &network.PublicIPAddressSkuArgs{
				Name: pulumi.String("Standard"),
			},
		}, pulumi.Parent(resourceGroup))
		if err != nil {
			return err
		}

		classicPublicIp, err := network.NewPublicIPAddress(ctx, "classic", &network.PublicIPAddressArgs{
			ResourceGroupName:        resourceGroup.Name,
			PublicIPAllocationMethod: pulumi.String("Static"),
			Sku: &network.PublicIPAddressSkuArgs{
				Name: pulumi.String("Standard"),
			},
		}, pulumi.Parent(resourceGroup))
		if err != nil {
			return err
		}

		appGw, err := network.NewApplicationGateway(ctx, "lbriggs", &network.ApplicationGatewayArgs{
			ResourceGroupName:      resourceGroup.Name,
			ApplicationGatewayName: pulumi.String("lbriggs"),
			Sku: &network.ApplicationGatewaySkuArgs{
				Name:     pulumi.String("Standard_v2"),
				Capacity: pulumi.Int(2),
				Tier:     pulumi.String("Standard_v2"),
			},
			GatewayIPConfigurations: network.ApplicationGatewayIPConfigurationArray{
				&network.ApplicationGatewayIPConfigurationArgs{
					Name: pulumi.String("appGatewayIpConfig"),
					Subnet: network.SubResourceArgs{
						Id: vnet.Subnets.Index(pulumi.Int(1)).Id(),
					},
				},
			},
			FrontendPorts: network.ApplicationGatewayFrontendPortArray{
				&network.ApplicationGatewayFrontendPortArgs{
					Name: pulumi.String("http"),
					Port: pulumi.IntPtr(80),
				},
				&network.ApplicationGatewayFrontendPortArgs{
					Name: pulumi.String("https"),
					Port: pulumi.IntPtr(443),
				},
			},
			FrontendIPConfigurations: network.ApplicationGatewayFrontendIPConfigurationArray{
				&network.ApplicationGatewayFrontendIPConfigurationArgs{
					Name: pulumi.String("public"),
					PublicIPAddress: network.SubResourceArgs{
						Id: publicIp.ID(),
					},
				},
			},
			BackendAddressPools: network.ApplicationGatewayBackendAddressPoolArray{
				&network.ApplicationGatewayBackendAddressPoolArgs{
					Name: pulumi.String("backend"),
				},
			},
			BackendHttpSettingsCollection: network.ApplicationGatewayBackendHttpSettingsArray{
				&network.ApplicationGatewayBackendHttpSettingsArgs{
					Name:                pulumi.String("http"),
					CookieBasedAffinity: pulumi.String("Disabled"),
					Port:                pulumi.IntPtr(80),
					Protocol:            pulumi.String("Http"),
					RequestTimeout:      pulumi.IntPtr(30),
				},
			},
			HttpListeners: network.ApplicationGatewayHttpListenerArray{
				&network.ApplicationGatewayHttpListenerArgs{
					Name: pulumi.String("http"),
					FrontendIPConfiguration: network.SubResourceArgs{
						Id: pulumi.String("$self/frontendIPConfigurations/public"),
					},
					FrontendPort: network.SubResourceArgs{
						Id: pulumi.String("$self/frontendPorts/http"),
					},
				},
			},
			RequestRoutingRules: network.ApplicationGatewayRequestRoutingRuleArray{
				&network.ApplicationGatewayRequestRoutingRuleArgs{
					RuleType: pulumi.String("Basic"),
					Name:     pulumi.String("default"),
					BackendAddressPool: network.SubResourceArgs{
						Id: pulumi.String("$self/backendAddressPools/backend"),
					},
					BackendHttpSettings: network.SubResourceArgs{
						Id: pulumi.String("$self/backendHttpSettingsCollection/http"),
					},
					HttpListener: network.SubResourceArgs{
						Id: pulumi.String("$self/httpListeners/http"),
					},
					Priority: pulumi.IntPtr(1),
				},
			},
		})
		if err != nil {
			return err
		}

		backendAddressPoolName := pulumi.String("backend")
		backendHttpSettings := pulumi.String("http")
		httpListenerName := pulumi.String("http")
		frontEndIpConfigurationName := pulumi.String("public")
		httpFrontEndPortName := pulumi.String("http")
		httpsFrontEndPortName := pulumi.String("https")

		agw, err := classicNetwork.NewApplicationGateway(ctx, "agw", &classicNetwork.ApplicationGatewayArgs{
			ResourceGroupName: resourceGroup.Name,
			GatewayIpConfigurations: classicNetwork.ApplicationGatewayGatewayIpConfigurationArray{
				classicNetwork.ApplicationGatewayGatewayIpConfigurationArgs{
					Name:     pulumi.String("appGatewayIpConfig"),
					SubnetId: vnet.Subnets.Index(pulumi.Int(1)).Id().Elem().ToStringOutput(),
				},
			},
			FrontendPorts: classicNetwork.ApplicationGatewayFrontendPortArray{
				&classicNetwork.ApplicationGatewayFrontendPortArgs{
					Name: httpFrontEndPortName,
					Port: pulumi.Int(80),
				},
				&classicNetwork.ApplicationGatewayFrontendPortArgs{
					Name: httpsFrontEndPortName,
					Port: pulumi.Int(443),
				},
			},
			FrontendIpConfigurations: classicNetwork.ApplicationGatewayFrontendIpConfigurationArray{
				classicNetwork.ApplicationGatewayFrontendIpConfigurationArgs{
					Name:              frontEndIpConfigurationName,
					PublicIpAddressId: classicPublicIp.ID(),
				},
			},
			BackendAddressPools: classicNetwork.ApplicationGatewayBackendAddressPoolArray{
				&classicNetwork.ApplicationGatewayBackendAddressPoolArgs{
					Name: backendAddressPoolName,
				},
			},
			BackendHttpSettings: classicNetwork.ApplicationGatewayBackendHttpSettingArray{
				classicNetwork.ApplicationGatewayBackendHttpSettingArgs{
					Name:                pulumi.String("http"),
					CookieBasedAffinity: pulumi.String("Disabled"),
					Port:                pulumi.Int(80),
					Protocol:            pulumi.String("Http"),
					RequestTimeout:      pulumi.IntPtr(30),
				},
			},
			HttpListeners: classicNetwork.ApplicationGatewayHttpListenerArray{
				&classicNetwork.ApplicationGatewayHttpListenerArgs{
					Name:                        httpListenerName,
					FrontendIpConfigurationName: frontEndIpConfigurationName,
					FrontendPortName:            httpFrontEndPortName,
					Protocol:                    pulumi.String("Http"),
				},
			},
			RequestRoutingRules: classicNetwork.ApplicationGatewayRequestRoutingRuleArray{
				&classicNetwork.ApplicationGatewayRequestRoutingRuleArgs{
					RuleType:                pulumi.String("Basic"),
					Name:                    pulumi.String("default"),
					BackendAddressPoolName:  backendAddressPoolName, // use the same name as the above settings
					BackendHttpSettingsName: backendHttpSettings,
					HttpListenerName:        httpListenerName,
					Priority:                pulumi.IntPtr(1),
				},
			},

			AutoscaleConfiguration: &classicNetwork.ApplicationGatewayAutoscaleConfigurationArgs{
				MaxCapacity: pulumi.Int(10),
				MinCapacity: pulumi.Int(1),
			},
			Sku: &classicNetwork.ApplicationGatewaySkuArgs{
				Name: pulumi.String("WAF_v2"),
				Tier: pulumi.String("WAF_v2"),
			},
			WafConfiguration: &classicNetwork.ApplicationGatewayWafConfigurationArgs{
				Enabled:        pulumi.Bool(true),
				FirewallMode:   pulumi.String("Detection"),
				RuleSetVersion: pulumi.String("3.2"),
			},
		})
		if err != nil {
			return err
		}

		ctx.Export("vnetId", vnet.ID())
		ctx.Export("identityName", identity.Name)
		ctx.Export("ipAddress", publicIp.IpAddress)
		ctx.Export("appGwId", appGw.ID())
		ctx.Export("classicAppGwId", agw.ID())

		return nil
	})
}
