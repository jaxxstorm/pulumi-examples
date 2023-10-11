package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/cloudfront"
	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/iam"
	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/route53"
	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		bucket, err := s3.NewBucketV2(ctx, "bucket", &s3.BucketV2Args{
			Bucket: pulumi.String("lbriggs-example-website"),
		})
		if err != nil {
			return err
		}
		cloudfront, err := cloudfront.NewDistribution(ctx, "cloudfront", &cloudfront.DistributionArgs{
			Enabled:           pulumi.Bool(true),
			WaitForDeployment: pulumi.Bool(false),
			Origins: cloudfront.DistributionOriginArray{
				&cloudfront.DistributionOriginArgs{
					OriginId:   pulumi.String("lbriggs-example-website-origin"),
					DomainName: bucket.BucketRegionalDomainName,
					CustomOriginConfig: &cloudfront.DistributionOriginCustomOriginConfigArgs{
						HttpPort:             pulumi.Int(80),
						HttpsPort:            pulumi.Int(443),
						OriginProtocolPolicy: pulumi.String("http-only"),
						OriginSslProtocols: pulumi.StringArray{
							pulumi.String("TLSv1"),
						},
					},
				},
			},
			DefaultCacheBehavior: &cloudfront.DistributionDefaultCacheBehaviorArgs{
				TargetOriginId: pulumi.String("lbriggs-example-website-origin"),
				AllowedMethods: pulumi.StringArray{
					pulumi.String("GET"),
					pulumi.String("HEAD"),
				},
				CachedMethods: pulumi.StringArray{
					pulumi.String("GET"),
					pulumi.String("HEAD"),
				},
				ForwardedValues: &cloudfront.DistributionDefaultCacheBehaviorForwardedValuesArgs{
					QueryString: pulumi.Bool(true),
					Cookies: &cloudfront.DistributionDefaultCacheBehaviorForwardedValuesCookiesArgs{
						Forward: pulumi.String("all"),
					},
				},
				ViewerProtocolPolicy: pulumi.String("redirect-to-https"),
				MinTtl:               pulumi.Int(0),
				DefaultTtl:           pulumi.Int(0),
				MaxTtl:               pulumi.Int(0),
			},
			Restrictions: &cloudfront.DistributionRestrictionsArgs{
				GeoRestriction: &cloudfront.DistributionRestrictionsGeoRestrictionArgs{
					RestrictionType: pulumi.String("none"),
				},
			},
			ViewerCertificate: &cloudfront.DistributionViewerCertificateArgs{
				CloudfrontDefaultCertificate: pulumi.Bool(true),
			},
			PriceClass: pulumi.String("PriceClass_200"),
		})
		if err != nil {
			return err
		}
		briggs, err := route53.LookupZone(ctx, &route53.LookupZoneArgs{
			Name: pulumi.StringRef("aws.briggs.work."),
		}, nil)
		if err != nil {
			return err
		}
		_, err = route53.NewRecord(ctx, "root_domain", &route53.RecordArgs{
			ZoneId: *pulumi.String(briggs.ZoneId),
			Name:   pulumi.String(fmt.Sprintf("www.%v", briggs.Name)),
			Type:   pulumi.String("A"),
			Aliases: route53.RecordAliasArray{
				&route53.RecordAliasArgs{
					Name:                 cloudfront.DomainName,
					ZoneId:               cloudfront.HostedZoneId,
					EvaluateTargetHealth: pulumi.Bool(false),
				},
			},
		})
		if err != nil {
			return err
		}
		policydoc := iam.GetPolicyDocumentOutput(ctx, iam.GetPolicyDocumentOutputArgs{
			Statements: iam.GetPolicyDocumentStatementArray{
				&iam.GetPolicyDocumentStatementArgs{
					Sid: pulumi.String("AllowCloudFrontServicePrincipal"),
					Actions: pulumi.StringArray{
						pulumi.String("s3:GetObject"),
					},
					Resources: pulumi.StringArray{
						bucket.Arn.ApplyT(func(arn string) (string, error) {
							return fmt.Sprintf("%v/*", arn), nil
						}).(pulumi.StringOutput),
					},
					Conditions: iam.GetPolicyDocumentStatementConditionArray{
						&iam.GetPolicyDocumentStatementConditionArgs{
							Test:     pulumi.String("StringEquals"),
							Variable: pulumi.String("AWS:SourceArn"),
							Values: pulumi.StringArray{
								cloudfront.Arn,
							},
						},
					},
					Principals: iam.GetPolicyDocumentStatementPrincipalArray{
						&iam.GetPolicyDocumentStatementPrincipalArgs{
							Type: pulumi.String("Service"),
							Identifiers: pulumi.StringArray{
								pulumi.String("cloudfront.amazonaws.com"),
							},
						},
					},
				},
			},
		}, nil)
		_, err = s3.NewBucketPolicy(ctx, "policy", &s3.BucketPolicyArgs{
			Bucket: bucket.ID(),
			Policy: policydoc.ApplyT(func(policydoc iam.GetPolicyDocumentResult) (*string, error) {
				return &policydoc.Json, nil
			}).(pulumi.StringPtrOutput),
		})
		if err != nil {
			return err
		}
		wc, err := s3.NewBucketWebsiteConfigurationV2(ctx, "wc", &s3.BucketWebsiteConfigurationV2Args{
			Bucket: bucket.Bucket,
			IndexDocument: &s3.BucketWebsiteConfigurationV2IndexDocumentArgs{
				Suffix: pulumi.String("index.html"),
			},
			ErrorDocument: &s3.BucketWebsiteConfigurationV2ErrorDocumentArgs{
				Key: pulumi.String("index.html"),
			},
			RoutingRuleDetails: pulumi.String(`[{
    "Condition": {
        "KeyPrefixEquals": "docs/"
    },
    "Redirect": {
        "ReplaceKeyPrefixWith": ""
    }
}]
`),
		})
		if err != nil {
			return err
		}
		_, err = s3.NewBucketVersioningV2(ctx, "versioning", &s3.BucketVersioningV2Args{
			Bucket: bucket.ID(),
			VersioningConfiguration: &s3.BucketVersioningV2VersioningConfigurationArgs{
				Status: pulumi.String("Enabled"),
			},
		})
		if err != nil {
			return err
		}
		_, err = s3.NewBucketPublicAccessBlock(ctx, "public_access_block", &s3.BucketPublicAccessBlockArgs{
			Bucket:                bucket.ID(),
			BlockPublicAcls:       pulumi.Bool(true),
			BlockPublicPolicy:     pulumi.Bool(true),
			IgnorePublicAcls:      pulumi.Bool(true),
			RestrictPublicBuckets: pulumi.Bool(true),
		})
		if err != nil {
			return err
		}
		ctx.Export("cloudfrontUrl", cloudfront.DomainName)
		ctx.Export("s3Url", wc.WebsiteEndpoint)
		return nil
	})
}
