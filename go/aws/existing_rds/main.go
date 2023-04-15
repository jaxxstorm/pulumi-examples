package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/rds"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		
		// lookup db cluster by properties
		// this returns strings
		instanceLookup, err := rds.LookupInstance(ctx, &rds.LookupInstanceArgs{
			DbInstanceIdentifier: "database-1",
		})
		if err != nil {
			return fmt.Errorf("error looking up cluster: %v", err)
		}

		// this will return an output type, which is much easier to use 
		// to pass values to other resources
		clusterLookupOutput := rds.LookupInstanceOutput(ctx, rds.LookupInstanceOutputArgs{
			DbInstanceIdentifier: pulumi.String("database-1"),
		})
		if err != nil {
			return fmt.Errorf("error looking up cluster: %v", err)
		}

		// this takes a resource name for state ("db")
		// and then an identifier for the resource
		// which for RDS is the name of the instance
		// we cast types by passing `pulumi.ID()``
		// I would not recommend this method, as it is not as easy to use
		getInstance, err := rds.GetInstance(ctx, "db", pulumi.ID("database-1"), nil)
		if err != nil {
			return fmt.Errorf("error looking up cluster: %v", err)
		}



		// example of using returned values

		// notice we have to cast this to a string
		ctx.Export("instanceLookupArn", pulumi.String(instanceLookup.DbInstanceArn))
		// this already returns an output type
		ctx.Export("instanceLookupOutputArn", clusterLookupOutput.DbInstanceArn())
		// this also already uses an output type
		ctx.Export("getInstanceArn", getInstance.Arn)
		return nil
	})
}
