package main

import (
	"fmt"
	"github.com/pulumi/pulumi-digitalocean/sdk/v2/go/digitalocean"
	"github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes"
	"github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/helm/v2"
	metav1 "github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/meta/v1"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi"
	corev1 "github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/core/v1"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// Create a Kubernetes cluster in DigitalOcean

		cluster, err := digitalocean.NewKubernetesCluster(ctx, "do-cluster", &digitalocean.KubernetesClusterArgs{
			Region: pulumi.String("sfo2"),
			Version: pulumi.String("1.16"),
			NodePool: &digitalocean.KubernetesClusterNodePoolArgs{
				Name: pulumi.String("default"),
				Size: pulumi.String("s-1vcpu-2gb"),
			},
		})

		if err != nil {
			return fmt.Errorf("Error creating cluster: ", err)
		}

		provider, err := kubernetes.NewProvider(ctx, "k8s", &kubernetes.ProviderArgs{
			Kubeconfig: cluster.KubeConfigs.Index(pulumi.Int(0)).RawConfig(),
		})

		if err != nil {
			return fmt.Errorf("Error instantating Kubernetes provider: ", err)
		}

		ns, err := corev1.NewNamespace(ctx, "nginx-ingress", &corev1.NamespaceArgs{
			Metadata: &metav1.ObjectMetaArgs{
				Name: pulumi.String("nginx-ingress"),
			},
		}, pulumi.Provider(provider))

		if err != nil {
			return fmt.Errorf("Error creating Kubernetes namespace: ", err)
		}

		_, err = helm.NewChart(ctx, "nginx-ingress", helm.ChartArgs{
			Chart: pulumi.String("nginx-ingress"),
			Version: pulumi.String("1.33.5"),
			Namespace: ns.Metadata.Name().Elem(),
			FetchArgs: &helm.FetchArgs{
				Repo: pulumi.String("https://kubernetes-charts.storage.googleapis.com/"),
			},
			Values: pulumi.Map{
				"controller": pulumi.Map{
					"replicaCount": pulumi.Int(1),
					"service": pulumi.Map{
						"type": pulumi.String("LoadBalancer"),
					},
					"publishService": pulumi.Map{
						"enabled": pulumi.Bool(true),
					},
				},
			},
		}, pulumi.Provider(provider))


		return nil
	})
}
