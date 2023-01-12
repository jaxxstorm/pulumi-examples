import pulumi

class MyMocks(pulumi.runtime.Mocks):
    def new_resource(self, args: pulumi.runtime.MockResourceArgs):
        outputs = args.inputs
        if args.typ == "azure-native:storage:StorageAccount":
            outputs = {
                **args.inputs,
                "primaryEndpoints": {
                    "web": "https://{}.z22.web.core.windows.net".format(args.name)
                }
            }
        if args.typ == "azure-native:cdn:Endpoint":
            outputs = {
                **args.inputs,
                "hostName": "{}.azureedge.net".format(args.name)
            }
        return [args.name + "_id", outputs]
            

    def call(self, args: pulumi.runtime.MockCallArgs):
        if (
            args.token
            == "azure-native:storage:getStorageAccount"
        ):
            return {}
        return {}


pulumi.runtime.set_mocks(MyMocks())


import website

https = website.Website(
    "https",
    args=website.WebsiteArgs(
        resource_group_name="bar",
        https=True
    ),
)

http = website.Website(
    "http",
    args=website.WebsiteArgs(
        resource_group_name="bar",
        https=False,
    )
)


@pulumi.runtime.test
def test_version():
    def check_tier(tier):
        assert tier == "Hot"
    return https.storage_account.access_tier.apply(check_tier)

@pulumi.runtime.test
def test_url():
    def check_url(url):
        assert url == "https://https.z22.web.core.windows.net"
    return https.storage_account.primary_endpoints.web.apply(check_url)

@pulumi.runtime.test
def test_endpoint_origin():
    def check_endpoint_origin(url):
        assert url == "https.z22.web.core.windows.net"
    return https.cdn_endpoint.origin_host_header.apply(check_endpoint_origin)

@pulumi.runtime.test
def test_https():
    def check_https_endpoint(http_allowed):
        assert http_allowed == False
    return https.cdn_endpoint.is_http_allowed.apply(check_https_endpoint)