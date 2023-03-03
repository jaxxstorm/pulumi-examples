"""An Azure RM Python Pulumi program"""

import pulumi
import pulumi_azure as azure
from pulumi_azure_native import storage
from pulumi_azure_native import resources

# Create an Azure Resource Group
resource_group = resources.ResourceGroup("resource_group")

classic_account = azure.storage.Account(
    "classic",
    resource_group_name=resource_group.name,
    account_tier="Standard",
    account_kind="BlobStorage",
    access_tier="Hot",
    account_replication_type="RAGRS",
)

pulumi.export("classic_connection_string", classic_account.primary_connection_string)

# # Create an Azure resource (Storage Account)
account = storage.StorageAccount(
    "account",
    resource_group_name=resource_group.name,
    sku=storage.SkuArgs(
        name=storage.SkuName.STANDARD_LRS,
    ),
    kind=storage.Kind.STORAGE_V2,
)

"""
The primary connection string is not an API response from the ARM API
We can use the actual API responses to form the connection string
"""
def get_connection_string(resource_group_name: pulumi.Output[str], account_name: pulumi.Output[str]) -> pulumi.Output[str]:
    keys = storage.list_storage_account_keys_output(resource_group_name=resource_group_name, account_name=account_name)
    """
    This is a secret because it contains the storage account key
    """
    return pulumi.Output.secret(pulumi.Output.format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};EndpointSuffix=core.windows.net", account_name, keys.keys[0].value))

pulumi.export("native_connnection_string", get_connection_string(resource_group.name, account.name))

# # Export the primary key of the Storage Account
# primary_key = pulumi.Output.all(resource_group.name, account.name) \
#     .apply(lambda args: storage.list_storage_account_keys(
#         resource_group_name=args[0],
#         account_name=args[1]
#     )).apply(lambda accountKeys: accountKeys.keys[0].value)

# pulumi.export("primary_storage_key", primary_key)
