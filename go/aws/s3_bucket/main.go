package main

import (
	"github.com/pulumi/pulumi-aws/sdk/v2/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v2/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		config := config.New(ctx, "")

		superSecret := config.RequireSecret("supersecret")

		// Create a a private bucket
		bucket, err := s3.NewBucket(ctx, "bucket", &s3.BucketArgs{Acl: pulumi.String("private")})
		if err != nil {
			return err
		}

		_, err = s3.NewBucketObject(ctx, "secret", &s3.BucketObjectArgs{
			Bucket:  bucket.ID(),
			Key:     pulumi.String("secret"),
			Content: pulumi.Sprintf("%s", superSecret),
		})

		ctx.Export("superSecret", superSecret)
		return nil
	})
}
