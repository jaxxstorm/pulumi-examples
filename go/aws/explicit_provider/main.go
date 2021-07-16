package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v4/go/aws"
	"github.com/pulumi/pulumi-aws/sdk/v4/go/aws/ec2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		useast1, err := aws.NewProvider(ctx, "us-east-1", &aws.ProviderArgs{
			Region: pulumi.String("us-east-1"),
		})
		if err != nil {
			return fmt.Errorf("error creating provider: %v", err)
		}

		t := true
		// uses the standard provider configured at the stack level
		vpc, err := ec2.LookupVpc(ctx, &ec2.LookupVpcArgs{Default: &t})
		if err != nil {
			return err
		}

		// uses an explicit provider
		usEastVpc, err := ec2.LookupVpc(ctx, &ec2.LookupVpcArgs{Default: &t}, pulumi.Provider(useast1))
		if err != nil {
			return err
		}

		ctx.Export("standard-vpc", pulumi.String(vpc.Id))
		ctx.Export("us-east-vpc", pulumi.String(usEastVpc.Id))

		return nil
	})
}
