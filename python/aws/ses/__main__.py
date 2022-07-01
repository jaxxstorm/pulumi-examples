import pulumi
import pulumi_aws as aws
import json

zone = aws.route53.get_zone_output(name="aws.briggs.work")

# create the SES domain
ses_domain_identity = aws.ses.DomainIdentity("ses", domain=zone.name)

# create the validation record
record = aws.route53.Record(
    "record",
    zone_id=zone.id,
    name=pulumi.Output.concat("_amazonses.", zone.name),
    type="TXT",
    ttl=600,
    records=[ses_domain_identity.verification_token],
)

# now we create an IAM user who can send emails via SES
smtp_user = aws.iam.User("user")

# create an access key, which will form the SMTP user/pass
access_key = aws.iam.AccessKey("access_key", user=smtp_user.name)

# allow the user to send emails
# note: we can reduce the scope here if we wanted
policy = aws.iam.Policy(
    "ses_policy",
    policy=json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {"Action": ["ses:SendRawEmail"], "Effect": "Allow", "Resource": "*"}
            ],
        }
    ),
)

# finally attach the policy to the user so it can send emails
aws.iam.UserPolicyAttachment(
    "smtp", user=smtp_user.name, policy_arn=policy.arn,
)

# export our SMTP credentials
pulumi.export("smtp_username", access_key.id)

# you will need to do `pulumi stack outout smtp_password --show-secrets to view this`
pulumi.export("smtp_password", access_key.ses_smtp_password_v4)
