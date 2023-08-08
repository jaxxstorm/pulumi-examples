import * as pulumi from "@pulumi/pulumi";
import * as databricks from "@pulumi/databricks";

const config = new pulumi.Config();
const token = config.requireSecret("token");
const host = config.require("host");

const testProvider = new databricks.Provider("test-workspace-provider", {
  token: token,
  host: pulumi.interpolate`https://${host}`,
}, { aliases: [ "urn:pulumi:dev::explicit_provider::pulumi:providers:databricks::default_1_18_0" ]});

const testProviderPolicy = new databricks.ClusterPolicy("test-something", {
  definition: "{}",
}, { provider: testProvider });

const testPolicy = new databricks.ClusterPolicy("example", {
  definition: "{}",
});
