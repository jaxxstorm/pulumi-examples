import pulumi
import pulumi_aws as aws
import json
import boto3

role = aws.iam.Role(
    "delete-lambda-versions",
    assume_role_policy=json.dumps({
        "Version": "2008-10-17",
        "Statement": [{
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }]
    }),
    managed_policy_arns=["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
)

func = aws.lambda_.Function("delete-lambda-versions",
    role=role.arn,
    runtime="python3.9",
    handler="hello.handler",
    code=pulumi.AssetArchive({
        '.': pulumi.FileArchive('./hello_lambda')
    }),
    publish=True,
)

def delete_old_lambda_versions(function_name: str):
    client = boto3.client('lambda')

    # List all the versions of the function
    response = client.list_versions_by_function(FunctionName=function_name)

    # Extract the version numbers, excluding the $LATEST
    versions = [x['Version'] for x in response['Versions'] if x['Version'] != '$LATEST']

    # Sort the versions in descending order
    versions.sort(key=int, reverse=True)
    
    # Exclude the last 3 versions
    versions_to_delete = versions[3:]
    
    for version in versions_to_delete:
        try:
            client.delete_function(FunctionName=function_name, Qualifier=version)
            pulumi.log.info(f"Deleted version {version}", resource=func)

        except client.exceptions.TypeError:
            pulumi.log.error(f"Deleted version {version}", resource=func)
    
    

pulumi.Output.all(func.arn).apply(lambda args: delete_old_lambda_versions(args[0]))
