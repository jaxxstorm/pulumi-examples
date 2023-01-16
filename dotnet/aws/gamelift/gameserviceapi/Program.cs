using Pulumi;
using Aws = Pulumi.Aws;
using System.Collections.Generic;
using System.Text.Json;

return await Deployment.RunAsync(() =>
{
    // playerData table
    var playerData = new Aws.DynamoDB.Table("playerData", new Aws.DynamoDB.TableArgs
    {
        BillingMode = "PAY_PER_REQUEST",
        Attributes = new[]
         {
            new Aws.DynamoDB.Inputs.TableAttributeArgs
            {
                Name = "ID",
                Type = "S",
            },

        },
        HashKey = "ID",
    });

    var matchMakingTickets = new Aws.DynamoDB.Table("matchMakingTickets", new Aws.DynamoDB.TableArgs
    {
        BillingMode = "PAY_PER_REQUEST",
        Attributes = new[]
      {
            new Aws.DynamoDB.Inputs.TableAttributeArgs
            {
                Name = "TicketID",
                Type = "S",
            },
      },
        HashKey = "TicketID",
        Ttl = new Aws.DynamoDB.Inputs.TableTtlArgs
        {
            AttributeName = "TTL",
            Enabled = true,
        },
    });

    var matchMakingTopic = new Aws.Sns.Topic("matchMakingTopic", new Aws.Sns.TopicArgs { });

    new Aws.Sns.TopicPolicy("matchMakingTopicPolicy", new Aws.Sns.TopicPolicyArgs
    {
        Arn = matchMakingTopic.Arn,
        Policy = matchMakingTopic.Arn.Apply(arn => JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["Version"] = "2012-10-17",
            ["Id"] = "SNS_TopicPolicy",
            ["Statement"] = new[]
            {
                new Dictionary<string, object>
                {
                    ["Sid"] = "SNS_TopicPolicy",
                    ["Effect"] = "Allow",
                    ["Principal"] = new Dictionary<string, object>
                    {
                        ["Service"] = "gamelift.amazonaws.com",
                    },
                    ["Action"] = "SNS:Publish",
                    ["Resource"] = arn,
                },
            },
        }))
    }, new CustomResourceOptions { Parent = matchMakingTopic });


});
