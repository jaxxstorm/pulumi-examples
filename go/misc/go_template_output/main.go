package main

import (
	//"bytes"
	_ "embed"
	//"fmt"
	//"io/fs"

	//"fmt"
	tls "github.com/pulumi/pulumi-tls/sdk/v4/go/tls"
	"os"
	"text/template"

	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

var (
	//go:embed data.tmpl
	data string
)

type DataArgs struct {
	PrivateKey string
	PublicKey  string
}

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		key, err := tls.NewPrivateKey(ctx, "my-private-key", &tls.PrivateKeyArgs{
			Algorithm:  pulumi.String("ECDSA"),
			EcdsaCurve: pulumi.String("P384"),
		})
		if err != nil {
			return err
		}

		pulumi.All(key.PrivateKeyPem, key.PublicKeyPem).ApplyT(
			func(args []interface{}) (string, error) {
				populatedData := DataArgs{PrivateKey: args[0].(string), PublicKey: args[1].(string)}

				dataTemplate := template.New("data")
				dataTemplate.Parse(data)
				err := dataTemplate.Execute(os.Stdout, populatedData)
				if err != nil {
					return "", err
				}

				return "", nil
			},
		)


		return nil
	})
}
