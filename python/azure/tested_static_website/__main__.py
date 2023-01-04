"""An Azure RM Python Pulumi program"""

import pulumi
from pulumi_azure_native import resources
from pulumi_azure_native import storage
import website

# Create an Azure Resource Group
resource_group = resources.ResourceGroup("testing_static_website")

site = website.Website(
    "static-website", website.WebsiteArgs(
        resource_group_name=resource_group.name,
        https=False
    )
)

# keep these out of the component so people can add their own
index_html = storage.Blob(
    "index_html",
    blob_name="index.html",
    resource_group_name=resource_group.name,
    account_name=site.storage_account.name,
    container_name=site.static_website.container_name,
    source=pulumi.FileAsset("./wwwroot/index.html"),
    content_type="text/html",
)
notfound_html = storage.Blob(
    "notfound_html",
    blob_name="404.html",
    resource_group_name=resource_group.name,
    account_name=site.storage_account.name,
    container_name=site.static_website.container_name,
    source=pulumi.FileAsset("./wwwroot/404.html"),
    content_type="text/html",
)

pulumi.export("address", site.cdn_endpoint.host_name)
pulumi.export("primary", site.storage_account.primary_endpoints.web)