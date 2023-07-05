import * as pulumi from "@pulumi/pulumi";
import * as databricks from "@pulumi/databricks";

const config = new pulumi.Config();
const token = config.requireSecret("token");

const testProvider = new databricks.Provider(
  "test-workspace-provider",
  {
    token: token,
    host: "https://adb-4075146692046647.7.azuredatabricks.net",
  },
  { aliases: [{ name: "default_1_18_0" }] }
);

const testPolicy = new databricks.ClusterPolicy(
  "test-something",
  {
    definition: "{}",
  },
  { provider: testProvider }
);
