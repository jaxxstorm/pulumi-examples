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

site = website.Website(
    "foo",
    args=website.WebsiteArgs(
        resource_group_name="bar",
        https=True
    ),
)


@pulumi.runtime.test
def test_version():
    def check_tier(tier):
        assert tier == "Hot"
    return site.storage_account.access_tier.apply(check_tier)

@pulumi.runtime.test
def test_url():
    def check_url(url):
        assert url == "https://foo.z22.web.core.windows.net"
    return site.storage_account.primary_endpoints.web.apply(check_url)

@pulumi.runtime.test
def test_endpoint_origin():
    def check_endpoint_origin(url):
        assert url == "foo.z22.web.core.windows.net"
    return site.cdn_endpoint.origin_host_header.apply(check_endpoint_origin)