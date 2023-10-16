"""An Azure RM Python Pulumi program"""

import pulumi
from pulumi_azure_native import resources
from pulumi_azure_native.dbforpostgresql import v20230301preview as dbforpostgresql

# Create an Azure Resource Group
resource_group = resources.ResourceGroup("example")


db = dbforpostgresql.Server(
    "example-flexible-server",
    administrator_login_password="c0rrect-hor5e-battery-st@ble",
    administrator_login="lbriggs",
    resource_group_name=resource_group.name,
    storage=dbforpostgresql.StorageArgs(
        storage_size_gb=32,
    ),
    sku=dbforpostgresql.SkuArgs(
        name="Standard_D2s_v3",
        tier="GeneralPurpose",
    ),
    version=dbforpostgresql.ServerVersion.SERVER_VERSION_12
)