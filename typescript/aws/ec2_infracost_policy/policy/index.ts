import * as aws from "@pulumi/aws";
import { PolicyPack, validateResourceOfType } from "@pulumi/policy";
import { gql, ApolloClient, InMemoryCache } from "@apollo/client";

new PolicyPack("aws-cost-infracost", {
  policies: [
    {
      name: "ec2-infracost-check",
      description: "Check how much an EC2 instance will cost.",
      enforcementLevel: "advisory",
      validateResource: validateResourceOfType(
        aws.s3.Bucket,
        async (instance, _, reportViolation) => {
          if (!process.env.INFRACOST_API_KEY) {
            reportViolation("policy requires INFRACOST_API_KEY env var");
          }

          const query = gql`
            # Get all t3.micro prices in US East, this returns 30+ results.

            query {
              products(
                filter: {
                  vendorName: "aws"
                  service: "AmazonEC2"
                  productFamily: "Compute Instance"
                  region: "us-east-1"
                  attributeFilters: [
                    { key: "instanceType", value: "t3.micro" },
                  ]
                }
              ), attributes { key, value } {
                prices {
                  USD
                }
              }
            }
          `;

          const requestHeaders = {
            "X-Api-Key": process.env.INFRACOST_API_KEY!,
          };

          const client = new ApolloClient({
            uri: "https://pricing.api.infracost.io/graphql",
            cache: new InMemoryCache(),
            headers: requestHeaders,
          });
          const results = await client.query({
            query: query,
          });

          console.log(results.data.products);
        }
      ),
    },
  ],
});
