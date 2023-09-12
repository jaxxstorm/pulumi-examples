# Databricks on AWS

This example showcases a full end to end deployment of databricks on AWS.

The databricks provider is used to create the databricks workspace and the databricks cluster. You need admin credentials to deploy this example.

You can set them in your stack configuration like so:

```
pulumi config set databricks:accountId <your account id> --secret
pulumi config set databricks:username <your databricks username>
pulumi config set databricks:password <your databricks password> --secret
pulumi config set databricks:host "https://accounts.cloud.databricks.com" # needed for admin credentials
```