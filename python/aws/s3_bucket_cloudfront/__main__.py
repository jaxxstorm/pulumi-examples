"""An AWS Python Pulumi program"""

import json
import mimetypes
import os
import pulumi
import pulumi_aws as aws

bucket = aws.s3.Bucket(
    "cloudfront",
    acl="private",
    website=aws.s3.BucketWebsiteArgs(
        index_document="index.html", error_document="404.html"
    ),
)

content_dir = "www"
for file in os.listdir(content_dir):
    filepath = os.path.join(content_dir, file)
    mime_type, _ = mimetypes.guess_type(filepath)
    obj = aws.s3.BucketObject(
        file,
        bucket=bucket.id,
        source=pulumi.FileAsset(filepath),
        content_type=mime_type,
        opts=pulumi.ResourceOptions(parent=bucket),
    )

origin_access_identity = aws.cloudfront.OriginAccessIdentity(
    "cloudfront",
    comment=pulumi.Output.concat("OAI-", bucket.id),
)

bucket_policy = aws.s3.BucketPolicy(
    "cloudfrontAccess",
    bucket=bucket.bucket,
    policy=pulumi.Output.all(
        cloudfront_iam_arn=origin_access_identity.iam_arn,
        bucket_arn=bucket.arn
    ).apply(
        lambda args: json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "CloudfrontAllow",
                        "Effect": "Allow",
                        "Principal": {
                            "AWS": args["cloudfront_iam_arn"],
                        },
                        "Action": "s3:GetObject",
                        "Resource": f"{args['bucket_arn']}/*",
                    }
                ],
            }
        )
    ),
    opts=pulumi.ResourceOptions(parent=bucket)
)

cloudfront_dist = aws.cloudfront.Distribution(
    "cloudfront_example",
    origins=[
        aws.cloudfront.DistributionOriginArgs(
            domain_name=bucket.bucket_regional_domain_name,
            origin_id="cloudfrontExample",
            s3_origin_config=aws.cloudfront.DistributionOriginS3OriginConfigArgs( # noqa
                origin_access_identity=origin_access_identity.cloudfront_access_identity_path, # noqa
            ),
        )
    ],
    enabled=True,
    is_ipv6_enabled=True,
    default_root_object="index.html",
    default_cache_behavior={
        "allowedMethods": [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
        ],
        "cachedMethods": [
            "GET",
            "HEAD",
        ],
        "targetOriginId": "cloudfrontExample",
        "forwardedValues": {
            "queryString": False,
            "cookies": {
                "forward": "none",
            },
        },
        "viewerProtocolPolicy": "allow-all",
        "minTtl": 0,
        "defaultTtl": 3600,
        "maxTtl": 86400,
    },
    restrictions={
        "geoRestriction": {
            "restrictionType": "whitelist",
            "locations": [
                "US",
                "CA",
                "GB",
                "DE",
            ],
        },
    },
    viewer_certificate={
        "cloudfrontDefaultCertificate": True,
    },
)

pulumi.export("bucket_address", bucket.bucket_domain_name)
pulumi.export("address", cloudfront_dist.domain_name)
