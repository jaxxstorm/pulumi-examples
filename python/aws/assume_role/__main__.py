"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws


provider = aws.Provider(
    "assume_role",
    aws.ProviderArgs(
        assume_role=aws.ProviderAssumeRoleArgs(
            role_arn="role.arn", session_name="something"
        ),
        region="us-west-2",
    ),
)

identity = aws.get_caller_identity(pulumi.InvokeOptions(provider=provider))

arn = identity.arn