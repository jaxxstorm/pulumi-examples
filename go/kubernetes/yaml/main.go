package main

import (
    "fmt"
	yaml "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/yaml"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

        name := "aws-loadbalancer-controller"

        _, err := yaml.NewConfigGroup(ctx, fmt.Sprintf("%s-crds", name), &yaml.ConfigGroupArgs{
			Files: []string{
                "elbv2.k8s.aws_targetgroupbindings.yaml",
			    "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/config/crd/bases/elbv2.k8s.aws_ingressclassparams.yaml",
			    },
		})

		if err != nil {
			return err
		}

		return nil
	})
}
