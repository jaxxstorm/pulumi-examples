import pulumi
import pulumi_aws as aws

bucket = aws.s3.BucketV2("bucket", bucket="lbriggs-example-website")
cloudfront = aws.cloudfront.Distribution(
    "cloudfront",
    enabled=True,
    wait_for_deployment=False,
    origins=[
        aws.cloudfront.DistributionOriginArgs(
            origin_id="lbriggs-example-website-origin",
            domain_name=bucket.bucket_regional_domain_name,
            custom_origin_config=aws.cloudfront.DistributionOriginCustomOriginConfigArgs(
                http_port=80,
                https_port=443,
                origin_protocol_policy="http-only",
                origin_ssl_protocols=["TLSv1"],
            ),
        )
    ],
    default_cache_behavior=aws.cloudfront.DistributionDefaultCacheBehaviorArgs(
        target_origin_id="lbriggs-example-website-origin",
        allowed_methods=[
            "GET",
            "HEAD",
        ],
        cached_methods=[
            "GET",
            "HEAD",
        ],
        forwarded_values=aws.cloudfront.DistributionDefaultCacheBehaviorForwardedValuesArgs(
            query_string=True,
            cookies=aws.cloudfront.DistributionDefaultCacheBehaviorForwardedValuesCookiesArgs(
                forward="all",
            ),
        ),
        viewer_protocol_policy="redirect-to-https",
        min_ttl=0,
        default_ttl=0,
        max_ttl=0,
    ),
    restrictions=aws.cloudfront.DistributionRestrictionsArgs(
        geo_restriction=aws.cloudfront.DistributionRestrictionsGeoRestrictionArgs(
            restriction_type="none",
        ),
    ),
    viewer_certificate=aws.cloudfront.DistributionViewerCertificateArgs(
        cloudfront_default_certificate=True,
    ),
    price_class="PriceClass_200",
)
briggs = aws.route53.get_zone_output(name="aws.briggs.work.")
root_domain = aws.route53.Record(
    "root_domain",
    zone_id=briggs.zone_id,
    name=briggs.apply(lambda briggs: f"www.{briggs.name}"),
    type="A",
    aliases=[
        aws.route53.RecordAliasArgs(
            name=cloudfront.domain_name,
            zone_id=cloudfront.hosted_zone_id,
            evaluate_target_health=False,
        )
    ],
)
policydoc = aws.iam.get_policy_document_output(
    statements=[
        aws.iam.GetPolicyDocumentStatementArgs(
            sid="AllowCloudFrontServicePrincipal",
            actions=["s3:GetObject"],
            resources=[bucket.arn.apply(lambda arn: f"{arn}/*")],
            conditions=[
                aws.iam.GetPolicyDocumentStatementConditionArgs(
                    test="StringEquals",
                    variable="AWS:SourceArn",
                    values=[cloudfront.arn],
                )
            ],
            principals=[
                aws.iam.GetPolicyDocumentStatementPrincipalArgs(
                    type="Service",
                    identifiers=["cloudfront.amazonaws.com"],
                )
            ],
        )
    ]
)
policy = aws.s3.BucketPolicy("policy", bucket=bucket.id, policy=policydoc.json)
wc = aws.s3.BucketWebsiteConfigurationV2(
    "wc",
    bucket=bucket.bucket,
    index_document=aws.s3.BucketWebsiteConfigurationV2IndexDocumentArgs(
        suffix="index.html",
    ),
    error_document=aws.s3.BucketWebsiteConfigurationV2ErrorDocumentArgs(
        key="index.html",
    ),
    routing_rule_details="""[{
    "Condition": {
        "KeyPrefixEquals": "docs/"
    },
    "Redirect": {
        "ReplaceKeyPrefixWith": ""
    }
}]
""",
)
versioning = aws.s3.BucketVersioningV2(
    "versioning",
    bucket=bucket.id,
    versioning_configuration=aws.s3.BucketVersioningV2VersioningConfigurationArgs(
        status="Enabled",
    ),
)
public_access_block = aws.s3.BucketPublicAccessBlock(
    "public_access_block",
    bucket=bucket.id,
    block_public_acls=True,
    block_public_policy=True,
    ignore_public_acls=True,
    restrict_public_buckets=True,
)
pulumi.export("cloudfrontUrl", cloudfront.domain_name)
pulumi.export("s3Url", wc.website_endpoint)
