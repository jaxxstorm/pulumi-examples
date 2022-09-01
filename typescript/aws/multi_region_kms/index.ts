import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// declare an array of regions
const regions = [
    "us-east-1",
    "us-west-2"
]
const accounts = [
    { profile: "pulumi-ce", account_id: "052848974346" },
    { profile: "pulumi-dev-sandbox", account_id: "616138583583" }
]
let providers: aws.Provider[] = []

// loop through all the accounts
accounts.forEach(account => {
    // for each account, loop through the regions
    regions.forEach(region => {
        let provider = new aws.Provider(`${account.profile}-${region}`, {
            profile: account.profile,
            allowedAccountIds: [ account.account_id ],
            region: region as aws.Region
        })

        providers.push(provider)

    })
})

// now loop through each created provider and create a resource for each

providers.forEach((provider, index) => {

    new aws.kms.Key(`key-${index}`, {
        deletionWindowInDays: 7,
        description: pulumi.interpolate`KMS key for ${provider.profile} in ${provider.region}`
    }, { provider: provider, parent: provider})

})
