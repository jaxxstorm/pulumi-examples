package main

import (
	"fmt"

	app "eks_kubevela/app/core/v1beta1"
	"github.com/pulumi/pulumi-awsx/sdk/go/awsx/ec2"
	"github.com/pulumi/pulumi-eks/sdk/go/eks"
	"github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes"
	corev1 "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/core/v1"
	"github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/helm/v3"
	metav1 "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/meta/v1"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		cidrBlock := "172.17.0.0/16"

		privateSubnet := ec2.SubnetSpecArgs{
			Type: ec2.SubnetTypePrivate,
		}

		publicSubnet := ec2.SubnetSpecArgs{
			Type: ec2.SubnetTypePublic,
		}

		vpc, err := ec2.NewVpc(ctx, "lbriggs", &ec2.VpcArgs{
			CidrBlock:          &cidrBlock,
			EnableDnsSupport:   pulumi.Bool(true),
			EnableDnsHostnames: pulumi.Bool(true),
			SubnetSpecs: []ec2.SubnetSpecArgs{
				privateSubnet,
				publicSubnet,
			},
		})
		if err != nil {
			return fmt.Errorf("error creating vpc")
		}

		cluster, err := eks.NewCluster(ctx, "lbriggs", &eks.ClusterArgs{
			PrivateSubnetIds:   vpc.PrivateSubnetIds,
			PublicSubnetIds:    vpc.PublicSubnetIds,
			VpcId:              vpc.VpcId,
			CreateOidcProvider: pulumi.Bool(true),
		})
		if err != nil {
			return fmt.Errorf("error creating cluster")
		}

		provider, err := kubernetes.NewProvider(ctx, "provider", &kubernetes.ProviderArgs{
			Kubeconfig: cluster.KubeconfigJson,
		})
		if err != nil {
			return fmt.Errorf("error creating provider")
		}

		ns, err := corev1.NewNamespace(ctx, "vela-system", &corev1.NamespaceArgs{
			Metadata: &metav1.ObjectMetaArgs{
				Name: pulumi.String("vela-system"),
			},
		}, pulumi.Provider(provider), pulumi.Parent(provider))
		if err != nil {
			return fmt.Errorf("error creating namespace: %v", err)
		}

		vela, err := helm.NewRelease(ctx, "kube-vela", &helm.ReleaseArgs{
			Chart:     pulumi.String("vela-core"),
			Namespace: ns.Metadata.Name(),
			RepositoryOpts: helm.RepositoryOptsArgs{
				Repo: pulumi.String("https://charts.kubevela.net/core"),
			},
		}, pulumi.Provider(provider), pulumi.Parent(provider))

		if err != nil {
			return fmt.Errorf("error creating helm release: %v", err)
		}

		// Export the name of the bucket
		ctx.Export("privateSubnetIds", vpc.PrivateSubnetIds)
		ctx.Export("publicSubnetIds", vpc.PublicSubnetIds)
		ctx.Export("vpcId", vpc.VpcId)
		ctx.Export("kubeconfig", cluster.KubeconfigJson)
		ctx.Export("releaseName", vela.Name)

		// Deploy the app
		application, err := app.NewApplication(ctx, "example", &app.ApplicationArgs{
			Metadata: &metav1.ObjectMetaArgs{
				Name: pulumi.String("example"),
				Namespace: pulumi.String("example"),
			},
			Spec: &app.ApplicationSpecArgs{
				Components: app.ApplicationSpecComponentsArray{
					&app.ApplicationSpecComponentsArgs{
						Name: pulumi.String("express-server"),
						Type: pulumi.String("webservice"),
						Properties: pulumi.Map{
							"image": pulumi.String("oamdev/hello-world"),
							"ports": pulumi.MapArray{
								pulumi.Map{
									"port": pulumi.Int(8000),
									"expose": pulumi.Bool(true),
								},
							},
						},
					},
				},
				Policies: app.ApplicationSpecPoliciesArray{
					&app.ApplicationSpecPoliciesArgs{
						Name: pulumi.String("target-default"),
						Type: pulumi.String("topology"),
						Properties: pulumi.Map{
							"namespace": pulumi.String("default"),
							"clusters":  pulumi.StringArray{
								pulumi.String("local"),
							},
						},
					},
					&app.ApplicationSpecPoliciesArgs{
						Name: pulumi.String("target-example"),
						Type: pulumi.String("topology"),
						Properties: pulumi.Map{
							"namespace": pulumi.String("example"),
							"clusters":  pulumi.StringArray{
								pulumi.String("local"),
							},
						},
					},
				},
				Workflow: &app.ApplicationSpecWorkflowArgs{
					Steps: app.ApplicationSpecWorkflowStepsArray{
						&app.ApplicationSpecWorkflowStepsArgs{
							Name: pulumi.String("default"),
							Type: pulumi.String("deploy"),
							Properties: pulumi.Map{
								"policies": pulumi.StringArray{
									pulumi.String("target-default"),
								},
							},
						},
						&app.ApplicationSpecWorkflowStepsArgs{
							Name: pulumi.String("example"),
							Type: pulumi.String("deploy"),
							Properties: pulumi.Map{
								"policies": pulumi.StringArray{
									pulumi.String("target-example"),
								},
							},
						},
					},
				},
			},
		}, pulumi.Provider(provider), pulumi.Parent(provider))

		if err != nil {
			return fmt.Errorf("error creating vela application: %v", err)
		}

		ctx.Export("applicationName", application.Metadata.Elem().Name())

		return nil
	})
}
