package main

import (
	"encoding/json"
	"fmt"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/iam"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
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

		// notice how we're using the apply function to wrap the building of the JSON string
		bucketPolicy := bucket.Arn.ApplyT(func(arn string) (string, error) {
			policyJSON, err := json.Marshal(map[string]interface{}{
				"Version": "2012-10-17",
				"Statement": []map[string]interface{}{
					{
						"Effect":    "Allow",
						"Principal": "*",
						"Action":    []string{"s3:GetObject"},
						"Resource": []string{
							arn, // I can now pass the arn directy
						},
					},
				},
			})
			if err != nil {
				return "", err
			}
			return string(policyJSON), nil
		})

		_, err = iam.NewRole(ctx, "s3BucketAccess", &iam.RoleArgs{
			AssumeRolePolicy: bucketPolicy,
		})
		if err != nil {
			return fmt.Errorf("error creating bucket policy")
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
