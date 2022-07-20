package main

import (
	"github.com/pulumi/pulumi-awsx/sdk/go/awsx/ec2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		
		vpc, err := ec2.NewVpc(ctx, "lbriggs", &ec2.VpcArgs{})
		if err != nil {
			ctx.Log.Error("Error creating new vpc", &pulumi.LogArgs{})
		}


		// Export for use elsewhere
		ctx.Export("vpcId", vpc.VpcId)
		ctx.Export("publicSubnetIds", vpc.PublicSubnetIds)
		ctx.Export("privateSubnetIds", vpc.PrivateSubnetIds)
		return nil
	})
}
