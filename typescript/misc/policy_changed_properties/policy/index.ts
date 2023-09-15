import * as aws from "@pulumi/aws";
import * as random from "@pulumi/random";
import * as pulumi from "@pulumi/pulumi";
import { PolicyPack, validateResourceOfType } from "@pulumi/policy";

new PolicyPack("resource-values-changes", {
  policies: [
    {
      name: "check-if-resource-values-changed",
      description:
        "Examines resources in the stack against the Pulumi resource state API to see if any values have changed.",
      enforcementLevel: "mandatory",
      validateResource: async (args, reportViolation) => {
        if (!process.env.PULUMI_ACCESS_TOKEN) {
          reportViolation("policy requires PULUMI_ACCESS_TOKEN env var");
        }

        const headers = {
          Accept: "application/json",
          Authorization: `token ${process.env.PULUMI_ACCESS_TOKEN}`,
        };

        const query = `urn:${args.urn}`;
        const body = await fetch(
          `https://api.pulumi.com/api/orgs/${pulumi.getOrganization()}/search/resources?query=${query}&properties=true`,
          {
            method: "GET",
            headers: headers,
          }
        );
        const data = await body.json();
        const resultCount = data.total;

        if (resultCount < 0) {
            reportViolation(`found ${resultCount} resources, perhaps the resource hasn't been created yet`);
          }

        data.resources.forEach((resource: any) => {
            for (let key in resource.properties) {
                if (resource.properties.hasOwnProperty(key)) {  // Ensure you're not getting properties from the prototype chain
                    let currentValue = resource.properties[key];
                    let oldValue = args.props[key];
                    if (currentValue != oldValue && oldValue != undefined) {
                        reportViolation(`property ${key} has changed from ${oldValue} to ${currentValue}`);
                    }
                }
            }
        });

        

        // data.resources.forEach((resource: any) => {

        // });


      },
    },
  ],
});


