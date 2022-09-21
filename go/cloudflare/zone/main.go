package main

import (
	"github.com/pulumi/pulumi-cloudflare/sdk/v4/go/cloudflare"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		zone, err := cloudflare.NewZone(ctx, "zone.io", &cloudflare.ZoneArgs{
			AccountId: pulumi.String("foo"),
			Plan:      pulumi.String("free"),
			Zone:      pulumi.String("leebriggs.io"),
		})
		if err != nil {
			return err
		}

		record, err := cloudflare.NewRecord(ctx, "test_record", &cloudflare.RecordArgs{
			ZoneId:  zone.ID(),
			Name:    pulumi.String("test"),
			Value:   pulumi.String("0.0.0.0"),
			Type:    pulumi.String("A"),
			Ttl:     pulumi.Int(1),
			Proxied: pulumi.Bool(true),
		})

		ctx.Export("recordName", record.Name)

		if err != nil {
			return err
		}

		return nil
	})
}
