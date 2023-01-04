import pulumi
import pulumi_azure_native as azure_native


class WebsiteArgs:
    def __init__(self, resource_group_name: str, https: bool = True):

        self.resource_group_name = resource_group_name
        self.https = https


class Website(pulumi.ComponentResource):

    storage_account: azure_native.storage.StorageAccount
    cdn_profile: azure_native.cdn.Profile
    cdn_endpoint: azure_native.cdn.Endpoint
    static_website: azure_native.storage.StorageAccountStaticWebsite

    def __init__(
        self, name: str, args: WebsiteArgs, opts: pulumi.ResourceOptions = None
    ):
        super().__init__("module:index:Website", name, None, opts)

        # filter any input names to make them azure friendly
        friendly_name = "".join(filter(str.isalnum, name))

        self.cdn_profile = azure_native.cdn.Profile(
            friendly_name,
            resource_group_name=args.resource_group_name,
            sku=azure_native.cdn.SkuArgs(
                name=azure_native.cdn.SkuName.STANDARD_MICROSOFT,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        self.storage_account = azure_native.storage.StorageAccount(
            friendly_name,
            access_tier=azure_native.storage.AccessTier.HOT,
            enable_https_traffic_only=True if args.https else False,
            encryption=azure_native.storage.EncryptionArgs(
                key_source=azure_native.storage.KeySource.MICROSOFT_STORAGE,
                services=azure_native.storage.EncryptionServicesArgs(
                    blob=azure_native.storage.EncryptionServiceArgs(
                        enabled=True,
                    ),
                    file=azure_native.storage.EncryptionServiceArgs(
                        enabled=True,
                    ),
                ),
            ),
            kind=azure_native.storage.Kind.STORAGE_V2,
            network_rule_set=azure_native.storage.NetworkRuleSetArgs(
                bypass=azure_native.storage.Bypass.AZURE_SERVICES,
                default_action=azure_native.storage.DefaultAction.ALLOW,
            ),
            resource_group_name=args.resource_group_name,
            sku=azure_native.storage.SkuArgs(
                name=azure_native.storage.SkuName.STANDARD_LRS,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        endpoint_origin = self.storage_account.primary_endpoints.apply(
            lambda primary_endpoints: primary_endpoints.web.replace(
                "https://", ""
            ).replace("/", "")
        )

        self.cdn_endpoint = azure_native.cdn.Endpoint(
            friendly_name,
            endpoint_name=self.storage_account.name.apply(
                lambda sa: f"cdn-endpnt-{sa}"
            ),
            is_http_allowed=False if args.https else True,
            is_https_allowed=True if args.https else False,
            origin_host_header=endpoint_origin,
            origins=[
                azure_native.cdn.DeepCreatedOriginArgs(
                    host_name=endpoint_origin,
                    https_port=443 if args.https else None,
                    http_port=80 if not args.https else None,
                    name="origin-storage-account",
                )
            ],
            profile_name=self.cdn_profile.name,
            query_string_caching_behavior=azure_native.cdn.QueryStringCachingBehavior.NOT_SET,
            resource_group_name=args.resource_group_name,
            opts=pulumi.ResourceOptions(parent=self.cdn_profile),
        )

        self.static_website = azure_native.storage.StorageAccountStaticWebsite(
            friendly_name,
            account_name=self.storage_account.name,
            resource_group_name=args.resource_group_name,
            index_document="index.html",
            error404_document="404.html",
            opts=pulumi.ResourceOptions(parent=self.storage_account),
        )

        self.register_outputs
