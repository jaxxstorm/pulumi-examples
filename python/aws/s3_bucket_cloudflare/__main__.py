"""An AWS Python Pulumi program"""

import pulumi
import json
import os
import mimetypes
import pulumi_aws as aws
import pulumi_cloudflare as cloudflare

bucket = aws.s3.Bucket(
    "static.briggs.work",
    bucket="static.briggs.work",
    website=aws.s3.BucketWebsiteArgs(
        index_document="index.html", error_document="404.html"
    ),
    opts=pulumi.ResourceOptions(delete_before_replace=True),
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
    )


def allow_cloudflare_ips(bucket_arn):
    return json.dumps(
        {
            "Id": "Policy1517260196123",
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "s3:*",
                    "Effect": "Deny",
                    "Resource": f"{bucket_arn}/*",
                    "Condition": {
                        "NotIpAddress": {
                            "aws:SourceIp": [
                                "103.21.244.0/22",
                                "103.22.200.0/22",
                                "103.31.4.0/22",
                                "104.16.0.0/12",
                                "108.162.192.0/18",
                                "131.0.72.0/22",
                                "141.101.64.0/18",
                                "162.158.0.0/15",
                                "172.64.0.0/13",
                                "173.245.48.0/20",
                                "188.114.96.0/20",
                                "190.93.240.0/20",
                                "197.234.240.0/22",
                                "198.41.128.0/17",
                                "2400:cb00::/32",
                                "2405:8100::/32",
                                "2405:b500::/32",
                                "2606:4700::/32",
                                "2803:f800::/32",
                                "2c0f:f248::/32",
                                "2a06:98c0::/29",
                            ]
                        }
                    },
                    "Principal": {"AWS": "*"},
                }
            ],
        }
    )


bucketPolicy = aws.s3.BucketPolicy(
    "allowCloudflare",
    bucket=bucket.bucket,
    policy=bucket.arn.apply(allow_cloudflare_ips),
    opts=pulumi.ResourceOptions(parent=bucket),
)

zone = cloudflare.get_zone(name="briggs.work")

record = cloudflare.Record(
    "static",
    zone_id=zone.id,
    name="static",
    value=bucket.website_endpoint,
    type="CNAME",
    ttl=3600,
)
