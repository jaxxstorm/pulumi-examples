package main

import (
	"fmt"
	"github.com/pulumi/pulumi-aws/sdk/v2/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		// import configuration options
		config := config.New(ctx, "")

		// get a secret value from the configuration
		superSecret := config.RequireSecret("supersecret")

		bucket, err := s3.NewBucket(ctx, "my-bucket", &s3.BucketArgs{
			Acl: pulumi.String("private"),
		})
		if err != nil {
			return err
		}

		values := []string{"key", "value"}

		for _, v := range values {
			_, err = s3.NewBucketObject(ctx, fmt.Sprintf("object-%s", v), &s3.BucketObjectArgs{
				Bucket:  bucket.ID(),
				Content: pulumi.Sprintf("%s", superSecret),
				Key:     pulumi.String("secret"),
			})
			if err != nil {
				return err
			}
		}


		return nil
	})
}

