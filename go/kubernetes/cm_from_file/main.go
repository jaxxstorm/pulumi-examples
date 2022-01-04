package main

import (
	"io/ioutil"
	corev1 "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/core/v1"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		dat, err := ioutil.ReadFile("assets/config.yaml")
		if err != nil {
			return err
		}

		_, err = corev1.NewConfigMap(ctx, "example", &corev1.ConfigMapArgs{
			Data: pulumi.StringMap{"data": pulumi.String(string(dat))},
		})
		if err != nil {
			return err
		}



		return nil
	})
}
