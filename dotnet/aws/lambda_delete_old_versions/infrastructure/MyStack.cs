using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Amazon;
using Amazon.Lambda;
using Amazon.Lambda.Model;
using Pulumi;
using Aws = Pulumi.Aws;
using System.Text.Json;

class MyStack : Stack
{
    public MyStack()
    {

        var role = new Aws.Iam.Role("example-dotnet-lambda", new Aws.Iam.RoleArgs
        {
            AssumeRolePolicy = JsonSerializer.Serialize(new
            {
                Version = "2008-10-17",
                Statement = new[]
            {
                new
                {
                    Sid = "",
                    Effect = "Allow",
                    Principal = new
                    {
                        Service = "lambda.amazonaws.com"
                    },
                    Action = "sts:AssumeRole"
                }
            }
            }),
            ManagedPolicyArns = new[]
            {
                "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
            }
        });
        // Create the Lambda function
        var lambda = new Aws.Lambda.Function("example", new Aws.Lambda.FunctionArgs
        {
            Runtime = "dotnetcore3.1",
            Code = new FileArchive("../function/DotnetLambda/src/DotnetLambda/bin/Debug/netcoreapp3.1/publish"),
            Handler = "DotnetLambda::DotnetLambda.Function::FunctionHandler",
            Role = role.Arn,
            Publish = true
        });

        this.LambdaVersion = lambda.Version;

        Output.Tuple(lambda.Version, lambda.Name)
            .Apply(async t =>
            {
                (string version, string name) = t;
                await DeleteOldVersions(name);
            });
    }

    [Output]
    public Output<string> LambdaVersion { get; set; }

    private static async Task DeleteOldVersions(string functionName)
    {
        using var client = new AmazonLambdaClient(RegionEndpoint.USWest2);

        var versions = await ListVersionsByFunction(client, functionName);
        var sortedVersions = SortVersionsByDate(versions);
        await DeleteOldVersions(client, functionName, sortedVersions);
    }

    private static async Task<List<FunctionConfiguration>> ListVersionsByFunction(AmazonLambdaClient client, string functionName)
    {
        var request = new ListVersionsByFunctionRequest { FunctionName = functionName };
        var response = await client.ListVersionsByFunctionAsync(request);
        return response.Versions;
    }

    private static List<FunctionConfiguration> SortVersionsByDate(List<FunctionConfiguration> versions)
    {
        return versions
                .Where(v => !string.Equals(v.Version, "$LATEST", StringComparison.Ordinal))
                .OrderByDescending(v => v.LastModified)
                .ToList();
    }

    private static async Task DeleteOldVersions(AmazonLambdaClient client, string functionName, List<FunctionConfiguration> sortedVersions)
    {
        int versionsToKeep = 3;

        if (sortedVersions.Count <= versionsToKeep) return;

        for (int i = versionsToKeep; i < sortedVersions.Count; i++)
        {
            var version = sortedVersions[i].Version;
            Console.WriteLine($"Deleting version {version} of function {functionName}");
            await client.DeleteFunctionAsync(new DeleteFunctionRequest
            {
                FunctionName = functionName,
                Qualifier = version
            });
        }
    }
}
