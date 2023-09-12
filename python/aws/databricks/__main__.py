import pulumi_aws as aws
import pulumi_awsx as awsx
import pulumi_databricks as databricks
import pulumi
import base64


databricks_config = pulumi.Config("databricks")
account_id = databricks_config.require("account_id")

awsconfig = pulumi.Config("aws")
aws_region = awsconfig.require("region")

# databricks needs a vpc to operate in
vpc = awsx.ec2.Vpc("databricks", cidr_block="172.16.0.0/16")

# create a security group that allows egress to anywhere for databricks to work
sg = aws.ec2.SecurityGroup(
    "databricks",
    vpc_id=vpc.vpc_id,
    egress=[
        aws.ec2.SecurityGroupEgressArgs(
            protocol="-1",
            from_port=0,
            to_port=0,
            cidr_blocks=["0.0.0.0/0"],
        )
    ],
)

# connect databricks to the private subnets
databricks_network = databricks.MwsNetworks(
    "databricks",
    vpc_id=vpc.vpc_id,
    subnet_ids=vpc.private_subnet_ids,
    security_group_ids=[sg.id],
    account_id=account_id,
    network_name="lbriggs",
)

# create a databricks root bucket
root_bucket = aws.s3.BucketV2(
    "databricks",
)

# enable encryption by the AWS Key
aws.s3.BucketServerSideEncryptionConfigurationV2(
    "databricks",
    bucket=root_bucket.id,
    rules=[
        aws.s3.BucketServerSideEncryptionConfigurationV2RuleArgs(
            apply_server_side_encryption_by_default=aws.s3.BucketServerSideEncryptionConfigurationV2RuleApplyServerSideEncryptionByDefaultArgs(
                sse_algorithm="AES256",
            )
        )
    ],
)

# block public access
aws.s3.BucketPublicAccessBlock(
    "databricks",
    bucket=root_bucket.id,
    block_public_acls=True,
    block_public_policy=True,
    ignore_public_acls=True,
    restrict_public_buckets=True,
    opts=pulumi.ResourceOptions(depends_on=[root_bucket]),
)

# defines the bucket policy requires for databricks to access
# this is a helper method that eases you defining the bucket policy
bucket_policy = databricks.get_aws_bucket_policy(bucket=root_bucket.bucket)

## you can define the bucket policy yourself, if you wish

# set the bucket policy
aws.s3.BucketPolicy("databricks", bucket=root_bucket.id, policy=bucket_policy.json)

# enable bucket versioning
aws.s3.BucketVersioningV2(
    "databricks",
    bucket=root_bucket.id,
    versioning_configuration=aws.s3.BucketVersioningV2VersioningConfigurationArgs(
        status="Disabled",
    ),
)

# set databricks to write to root bucket
storage_config = databricks.MwsStorageConfigurations(
    "databricks",
    account_id=account_id,
    bucket_name=root_bucket.bucket,
    storage_configuration_name="databricks",
)

# Allow databricks to assume role into our account
# this is a helper method to set the correct assume role policy
assume_role_policy = databricks.get_aws_assume_role_policy(external_id=account_id)
iam_role = aws.iam.Role("databricks", assume_role_policy=assume_role_policy.json)

# attach cross account role to iam role
# this is a helper method to help you create the cross account policy
cross_account_role_policy = databricks.get_aws_cross_account_policy()
aws.iam.RolePolicy(
    "databricks",
    role=iam_role.name,
    policy=cross_account_role_policy.json,
)

# create some credentials that aren't admin creds 
creds = databricks.MwsCredentials(
    "databricks",
    account_id=account_id,
    role_arn=iam_role.arn,
    credentials_name="lbriggs-databricks",
)

# create the workspace
workspace = databricks.MwsWorkspaces(
    "lbriggs",
    account_id=account_id,
    aws_region=aws_region,
    credentials_id=creds.credentials_id,
    storage_configuration_id=storage_config.storage_configuration_id,
    network_id=databricks_network.network_id,
    workspace_name="lbriggs",
    token={},
)

pulumi.export("workspace_id", workspace.workspace_id)
pulumi.export("workspace_url", workspace.workspace_url)
pulumi.export("workspace_token", workspace.token.token_value)


# create a new provider that uses the workspace credentials
databricks_provider = databricks.Provider(
    "workspace",
    account_id=account_id,
    host=workspace.workspace_url,
    token=workspace.token.token_value,
)

# define some content to run in the databricks notebook
notebook_content = "display(spark.range(10))"
notebook_content_bytes = notebook_content.encode("ascii")
notebook_base64_bytes = base64.b64encode(notebook_content_bytes)
notebook_base64_string = notebook_base64_bytes.decode("ascii")

# create a notenook
notebook = databricks.Notebook(
    "random",
    path="/pulumi",
    language="PYTHON",
    content_base64=notebook_base64_string,
    opts=pulumi.ResourceOptions(provider=databricks_provider), # Note the explicit provider here
)

# show the notebook url
pulumi.export("notebook_url", notebook.url)