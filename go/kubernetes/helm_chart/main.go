package main

import (
	"fmt"
	corev1 "github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/core/v1"
	"github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/helm/v2"
	metav1 "github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/meta/v1"
	"github.com/pulumi/pulumi-kubernetes/sdk/v2/go/kubernetes/providers"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		config := config.New(ctx, "")
		org := config.Require("org")
		clusterProject := config.Require("clusterProject")

		// Get stack reference
		slug := fmt.Sprintf("%s/%s/%v", org, clusterProject, ctx.Stack())
		stackRef, err := pulumi.NewStackReference(ctx, slug, nil)

		if err != nil {
			return err
		}

		kubeConfig := stackRef.GetOutput(pulumi.String("kubeconfig"))

		// provider init
		provider, err := providers.NewProvider(ctx, "k8sprovider", &providers.ProviderArgs{
			Kubeconfig: pulumi.StringPtrOutput(kubeConfig),
		})
		if err != nil {
			return err
		}

		// configmap
		_, err = corev1.NewConfigMap(ctx, "configmap", &corev1.ConfigMapArgs{
			Metadata: &metav1.ObjectMetaArgs{
				Name: pulumi.String("nginx-ingress"),
			},
			Data: pulumi.StringMap{
				"config": pulumi.String(string("test-config")),
			},
		}, pulumi.Provider(provider))

		if err != nil {
			return err
		}

		// Helm chart
		_, err = helm.NewChart(ctx, "test", helm.ChartArgs{
			Chart:   pulumi.String("stable/nginx-ingress"),
			Version: pulumi.String("1.36.3"),
		}, pulumi.Provider(provider))

		if err != nil {
			return err
		}
		return nil
	})
}
