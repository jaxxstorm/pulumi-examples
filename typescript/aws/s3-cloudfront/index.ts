import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const contentBucket = new aws.s3.Bucket("content-bucket", {
  acl: "private",
  website: {
    indexDocument: "index.html",
    errorDocument: "index.html",
  },
  forceDestroy: true,
});

const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
  "cloudfront",
  {
    comment: pulumi.interpolate`OAI-${contentBucket.bucketDomainName}`,
  }
);

originAccessIdentity.cloudfrontAccessIdentityPath.apply(value => {
  console.log(value)
})

// apply method
new aws.s3.BucketPolicy("apply-bucket-policy", {
  bucket: contentBucket.bucket,
  policy: pulumi
    .all([contentBucket.bucket, originAccessIdentity.iamArn])
    .apply(([bucketName, iamArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "CloudfrontAllow",
            Effect: "Allow",
            Principal: {
              AWS: iamArn,
            },
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${bucketName}/*`,
          },
        ],
      })
    ),
});

// policydocument method

new aws.s3.BucketPolicy('interpolate-bucket-policy', {
    bucket: contentBucket.bucket,
    policy: {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "CloudfrontAllow",
                Effect: "Allow",
                Principal: {
                    AWS: originAccessIdentity.iamArn,
                },
                Action: "s3:GetObject",
                Resource: pulumi.interpolate`arn:aws:s3:::${contentBucket.bucket}/*`,
            },
        ],
      } as aws.iam.PolicyDocument
})

export const bucketName = contentBucket.bucket
