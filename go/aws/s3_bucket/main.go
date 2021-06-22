package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v4/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {

		config := config.New(ctx, "")

		configValue := config.Require("contentvalue")
		secretValue := config.RequireSecret("supersecret")

		bucket, err := s3.NewBucket(ctx, "my-bucket", &s3.BucketArgs{})
		if err != nil {
			return fmt.Errorf("error creating bucket: %v", err)
		}

		plainValues := []string{
			configValue,
			"i-am-just-a-string",
		}

		for i, v := range plainValues {
			_, err := s3.NewBucketObject(ctx, fmt.Sprintf("object-%d", i), &s3.BucketObjectArgs{
				Bucket:  bucket.Bucket,
				Content: pulumi.String(v),
			})
			if err != nil {
				return fmt.Errorf("error creating bucket object: %v", err)
			}
		}

		_, err = s3.NewBucketObject(ctx, "secret-object", &s3.BucketObjectArgs{
			Bucket:  bucket.Bucket,
			Content: secretValue,
		})
		if err != nil {
			return fmt.Errorf("error creating secret object: %v", err)
		}

		ctx.Export("bucketId", bucket.ID())

		return nil
	})
}
