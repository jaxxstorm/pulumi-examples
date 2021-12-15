package main

import (
	"github.com/pulumi/pulumi-vsphere/sdk/v4/go/vsphere"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		opt0 := "a-dc"
		datacenter, err := vsphere.LookupDatacenter(ctx, &vsphere.LookupDatacenterArgs{
			Name: &opt0,
		}, nil)
		if err != nil {
			return err
		}
		opt1 := datacenter.Id
		_, err = vsphere.LookupVirtualMachine(ctx, &vsphere.LookupVirtualMachineArgs{
			DatacenterId: &opt1,
			Name:         "a-vm",
		}, nil)
		if err != nil {
			return err
		}
		return nil
	})
}
