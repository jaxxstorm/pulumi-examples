package main

import (
	"fmt"

	"github.com/pulumi/pulumi-eks/sdk/go/eks"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		slug := fmt.Sprintf("jaxxstorm/vpc_eks_go/%v", ctx.Stack())
		vpc, err := pulumi.NewStackReference(ctx, slug, nil)
		if err != nil {
			return fmt.Errorf("error getting vpc stack reference: %w", err)
		}

		privateSubnetIds := vpc.GetOutput(pulumi.String("privateSubnetIDs")).ApplyT(func(x interface{}) []string {
			y := x.([]interface{})

			r := make([]string, 0)
			for _, item := range y {
				r = append(r, item.(string))
			}
			return r
		}).(pulumi.StringArrayOutput)

		publicSubnetIds := vpc.GetOutput(pulumi.String("publicSubnetIDs")).ApplyT(func(x interface{}) []string {
			y := x.([]interface{})

			r := make([]string, 0)
			for _, item := range y {
				r = append(r, item.(string))
			}
			return r
		}).(pulumi.StringArrayOutput)


		cluster, err := eks.NewCluster(ctx, "lbriggs", &eks.ClusterArgs{
			PrivateSubnetIds: privateSubnetIds,
			PublicSubnetIds: publicSubnetIds,
		})
		if err != nil {
			return fmt.Errorf("error creating cluster: %w", err)
		}

		ctx.Export("clusterName", cluster.Core.Cluster().Name())

		return nil
	})
}

