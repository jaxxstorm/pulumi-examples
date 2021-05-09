package main

import (
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	tls "github.com/pulumi/pulumi-tls/sdk/v4/go/tls"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
	

		key, err := tls.NewPrivateKey(ctx, "example", &tls.PrivateKeyArgs{
			Algorithm: pulumi.String("RSA"),
			RsaBits: pulumi.Int(4096),
		})
		if err != nil {
			return err
		}

		ctx.Export("privateKey", key.PrivateKeyPem)
		ctx.Export("publicKey", key.PublicKeyOpenssh)

		return nil

	})
}
