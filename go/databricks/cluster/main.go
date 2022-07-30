package main

import (
	"fmt"
	"github.com/pulumi/pulumi-databricks/sdk/go/databricks"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		cluster, err := databricks.NewCluster(ctx, "example", &databricks.ClusterArgs{
			InitScripts: databricks.ClusterInitScriptArray{
				databricks.ClusterInitScriptArgs{
					S3: databricks.ClusterInitScriptS3Args{
						Destination: pulumi.String("something"),
					},
				},
			},
		})

		if err != nil {
			return fmt.Errorf("error creating cluster: %w", err)
		}

		ctx.Export("clusterName", cluster.ClusterName)

		return nil

	})
}
