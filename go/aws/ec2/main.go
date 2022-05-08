package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/ec2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		stackName := ctx.Stack()

		// Do a lookup for the latest Amazon Linux AMI
		mostRecent := true
		ami, err := ec2.LookupAmi(ctx, &ec2.LookupAmiArgs{
			Filters: []ec2.GetAmiFilter{
				{
					Name:   "name",
					Values: []string{"amzn-ami-hvm-*-x86_64-ebs"},
				},
			},
			Owners:     []string{"137112412989"},
			MostRecent: &mostRecent,
		})
		if err != nil {
			return fmt.Errorf("error looking up AMI")
		}

		// Create a valid webserver security group
		group, err := ec2.NewSecurityGroup(ctx, "web-secgrp", &ec2.SecurityGroupArgs{
			Ingress: ec2.SecurityGroupIngressArray{
				ec2.SecurityGroupIngressArgs{
					Protocol:   pulumi.String("tcp"),
					FromPort:   pulumi.Int(80),
					ToPort:     pulumi.Int(80),
					CidrBlocks: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
				},
			},
		})
		if err != nil {
			return err
		}

		userData := pulumi.Sprintf(`#!/bin/bash
		echo "Hello from stack %s" > index.html
		nohup python -m SimpleHTTPServer 80 &`, stackName)

		for i := 1; i <= 5; i++ {
			_, err = ec2.NewInstance(ctx, fmt.Sprintf("web-server-www-%d", i), &ec2.InstanceArgs{
				Tags:                pulumi.StringMap{"Name": pulumi.String(fmt.Sprintf("web-server-www-%d", i))},
				InstanceType:        pulumi.String("t2.micro"),
				VpcSecurityGroupIds: pulumi.StringArray{group.ID()},
				Ami:                 pulumi.String(ami.Id),
				UserData:            userData,
			})
			if err != nil {
				panic("error creating ec2 instance")
			}
		}

		// ctx.Export("ipAddress", srv.PublicIp)

		return nil
	})
}
