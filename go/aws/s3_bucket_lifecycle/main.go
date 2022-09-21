package main

import (
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/s3"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/s3control"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// Create an AWS resource (S3 Bucket)
		bucket, err := s3.NewBucket(ctx, "my-bucket", nil)
		if err != nil {
			return err
		}

		_, err = s3control.NewBucketLifecycleConfiguration(ctx, "example", &s3control.BucketLifecycleConfigurationArgs{
			Bucket: bucket.Bucket,
			Rules: s3control.BucketLifecycleConfigurationRuleArray{
				&s3control.BucketLifecycleConfigurationRuleArgs{
					Expiration: &s3control.BucketLifecycleConfigurationRuleExpirationArgs{
						Days: pulumi.Int(365),
					},
					Filter: &s3control.BucketLifecycleConfigurationRuleFilterArgs{
						Prefix: pulumi.String("logs/"),
					},
					Id: pulumi.String("logs"),
				},
				&s3control.BucketLifecycleConfigurationRuleArgs{
					Expiration: &s3control.BucketLifecycleConfigurationRuleExpirationArgs{
						Days: pulumi.Int(7),
					},
					Filter: &s3control.BucketLifecycleConfigurationRuleFilterArgs{
						Prefix: pulumi.String("temp/"),
					},
					Id: pulumi.String("temp"),
				},
			},
		})
		if err != nil {
			return err
		}

		// Export the name of the bucket
		ctx.Export("bucketName", bucket.ID())
		return nil
	})
}
