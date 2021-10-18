package main

import (
	"encoding/json"
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v4/go/aws/iam"
	"github.com/pulumi/pulumi-eks/sdk/go/eks"
	"github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes"

	corev1 "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/core/v1"
	"github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/helm/v2"
	metav1 "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/meta/v1"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		cluster, err := eks.NewCluster(ctx, "my-cluster", &eks.ClusterArgs{
			CreateOidcProvider: pulumi.Bool(true),
			ProviderCredentialOpts: &eks.KubeconfigOptionsArgs{
				ProfileName: pulumi.String("pulumi-dev-sandbox"),
			},
		})
		if err != nil {
			return err
		}

		oidcArn := cluster.Core.OidcProvider().ApplyT(func(oidcProvider *iam.OpenIdConnectProvider) pulumi.StringOutput {
			if oidcProvider == nil {
				return pulumi.String("").ToStringOutput()
			}
			return oidcProvider.Arn
		}).ApplyT(func(v interface{}) string {
			return v.(string)
		})

		oidcUrl := cluster.Core.OidcProvider().ApplyT(func(oidcProvider *iam.OpenIdConnectProvider) pulumi.StringOutput {
			if oidcProvider == nil {
				return pulumi.String("").ToStringOutput()
			}
			return oidcProvider.Url
		}).ApplyT(func(v interface{}) string {
			return v.(string)
		})

		ctx.Export("oidcArn", oidcArn)
		ctx.Export("oidcUrl", oidcUrl)

		// start cluster autoscaler configuration

		clusterAutoScalerRolePolicyJSON, err := json.Marshal(map[string]interface{}{
			"Version": "2012-10-17",
			"Statement": []interface{}{
				map[string]interface{}{
					"Action": []string{
						"autoscaling:DescribeAutoScalingGroups",
						"autoscaling:DescribeAutoScalingInstances",
						"autoscaling:DescribeLaunchConfigurations",
						"autoscaling:DescribeTags",
						"autoscaling:SetDesiredCapacity",
						"autoscaling:TerminateInstanceInAutoScalingGroup",
					},
					"Effect":   "Allow",
					"Resource": "*",
				},
			},
		})
		if err != nil {
			return err
		}

		namespaceName := "cluster-autoscaler"
		serviceAccountName := fmt.Sprintf("system:serviceaccount:%s:cluster-autoscaler-aws-cluster-autoscaler-chart", namespaceName)

		// assumeRolePolicyJSON, err := json.Marshal(map[string]interface{}{
		// 	"Version": "2012-10-17",
		// 	"Statement": []interface{}{
		// 		map[string]interface{}{
		// 			"Effect": "Allow",
		// 			"Principal": map[string]interface{}{
		// 				"Federated": oidcArn,
		// 			},
		// 			"Action": "sts:AssumeRoleWithWebIdentity",
		// 			"Condition": map[string]interface{}{
		// 				"StringEquals": map[string]interface{}{
		// 					fmt.Sprintf("%s:sub", oidcUrl): serviceAccountName,
		// 				},
		// 			},
		// 		},
		// 	},
		// })
		// if err != nil {
		// 	return err
		// }

		assumeRolePolicyJSON := pulumi.All(oidcUrl, oidcArn).ApplyT(
			func(args []interface{}) (string, error) {
				url := args[0].(string)
				arn := args[1].(string)
				policyJSON, err := json.Marshal(map[string]interface{}{
					"Version": "2012-10-17",
					"Statement": []interface{}{
						map[string]interface{}{
							"Effect": "Allow",
							"Principal": map[string]interface{}{
								"Federated": arn,
							},
							"Action": "sts:AssumeRoleWithWebIdentity",
							"Condition": map[string]interface{}{
								"StringEquals": map[string]interface{}{
									fmt.Sprintf("%s:sub", url): serviceAccountName,
								},
							},
						},
					},
				})
				if err != nil {
					return "", err
				}
				return string(policyJSON), nil
			},
		).(pulumi.StringOutput)

		clusterAutoScalerIamRole, err := iam.NewRole(ctx, "cs-role", &iam.RoleArgs{
			AssumeRolePolicy: assumeRolePolicyJSON,
		})
		if err != nil {
			return err
		}

		clusterAutoscalerPolicy, err := iam.NewPolicy(ctx, "cs-policy", &iam.PolicyArgs{
			Policy: pulumi.String(clusterAutoScalerRolePolicyJSON),
		}, pulumi.Parent(clusterAutoScalerIamRole))
		if err != nil {
			return err
		}

		_, err = iam.NewRolePolicyAttachment(ctx, "cs-policyAttachment", &iam.RolePolicyAttachmentArgs{
			Role:      clusterAutoScalerIamRole.Name,
			PolicyArn: clusterAutoscalerPolicy.Arn,
		}, pulumi.Parent(clusterAutoscalerPolicy))
		if err != nil {
			return err
		}

		kubeConfig := cluster.Kubeconfig.ApplyT(func (v interface{}) (string, error) {
			x, ok := v.(map[string]interface{})
			if ok {
				val, err := json.Marshal(x)
				if err != nil {
					return "", fmt.Errorf("error marshalling json: %v", err)
				}
				return string(val), nil
			}
			return "", fmt.Errorf("expected the kubeconfig to be json: %v", err)
		}).(pulumi.StringOutput)


		ctx.Export("kubeconfig", kubeConfig)

		provider, err := kubernetes.NewProvider(ctx, "provider", &kubernetes.ProviderArgs{
			Kubeconfig: kubeConfig,
		})
		if err != nil {
			return nil
		}

		_, err = corev1.NewNamespace(ctx, "cs-ns", &corev1.NamespaceArgs{
			Metadata: &metav1.ObjectMetaArgs{
				Name: pulumi.String(namespaceName),
			},
		}, pulumi.Provider(provider), pulumi.Parent(provider))
		if err != nil {
			return nil
		}

		_, err = helm.NewChart(ctx, "cluster-autoscaler", helm.ChartArgs{
			Chart: pulumi.String("cluster-autoscaler-chart"),
			FetchArgs: &helm.FetchArgs{
				Repo: pulumi.String("https://kubernetes.github.io/autoscaler"),
			},
			Values: pulumi.Map{
				"autoDiscovery": pulumi.Map{
					"clusterName": cluster.Name(),
				},
				"awsRegion": pulumi.String(region),
			},
			Namespace: pulumi.String(args.Namespace),
			Transformations: []yaml.Transformation{
				func(state map[string]interface{}, opts ...pulumi.ResourceOption) {
					if state["kind"] == "ServiceAccount" {
						metadata := state["metadata"].(map[string]interface{})
						metadata["annotations"] = map[string]interface{}{
							"eks.amazonaws.com/role-arn": clusterAutoScalerIamRole.Arn,
						}
					}
				},
			},
		})

		return nil
	})
}
