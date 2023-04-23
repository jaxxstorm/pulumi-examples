import pulumi_aws as aws
import pulumi
import json

bucket = aws.s3.Bucket("backup-bucket")

role = aws.iam.Role(
    "gitlab_role",
    assume_role_policy=json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "sts:AssumeRole",
                    "Principal": {"Service": "s3.amazonaws.com"},
                    "Effect": "Allow",
                    "Sid": "",
                }
            ],
        }
    ),
)

# Hard way
role_policy = aws.iam.RolePolicy(
    "gitlab_policy",
    role=role.id,
    policy=pulumi.Output.all(id=bucket.id, arn=bucket.arn,).apply(
        lambda args: json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": [
                            "s3:AbortMultipartUpload",
                            "s3:GetBucketAcl",
                            "s3:GetBucketLocation",
                            "s3:GetObject",
                            "s3:GetObjectAcl",
                            "s3:ListBucketMultipartUploads",
                            "s3:PutObject",
                            "s3:PutObjectAcl",
                        ],
                        "Effect": "Allow",
                        "Resource": [
                            f"arn:aws:s3:::{args['id']}",
                            f"arn:aws:s3:::{args['id']}/*",
                        ],
                    },
                    {
                        "Action": ["s3:GetBucketLocation", "s3:ListAllMyBuckets"],
                        "Effect": "Allow",
                        "Resource": "*",
                    },
                    {
                        "Action": ["s3:ListBucket"],
                        "Effect": "Allow",
                        "Resource": args["arn"],
                    },
                ],
            },
        ),
    ),
)

# Hard way
role_policy_1 = aws.iam.RolePolicy(
    "gitlab_policy-1",
    role=role.id,
    policy=pulumi.Output.json_dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "s3:AbortMultipartUpload",
                        "s3:GetBucketAcl",
                        "s3:GetBucketLocation",
                        "s3:GetObject",
                        "s3:GetObjectAcl",
                        "s3:ListBucketMultipartUploads",
                        "s3:PutObject",
                        "s3:PutObjectAcl",
                    ],
                    "Effect": "Allow",
                    "Resource": [
                        pulumi.Output.concat("arn:aws:s3:::", bucket.id),
                        pulumi.Output.concat("arn:aws:s3:::", bucket.id, "/*"),
                    ],
                },
                {
                    "Action": ["s3:GetBucketLocation", "s3:ListAllMyBuckets"],
                    "Effect": "Allow",
                    "Resource": "*",
                },
                {
                    "Action": ["s3:ListBucket"],
                    "Effect": "Allow",
                    "Resource": bucket.arn,
                },
            ],
        },
    ),
)
