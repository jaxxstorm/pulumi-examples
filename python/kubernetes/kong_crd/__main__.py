"""A Python Pulumi program"""

import pulumi
import crds.python.pulumi_crds as kongplugin
import pulumi_kubernetes as k8s

typed = kongplugin.configuration.v1.KongClusterPlugin(
    "rate-limiting",
    kongplugin.configuration.v1.KongClusterPluginArgs(
        plugin="rate-limiting", config={"minute": 5}
    ),
)

untyped = k8s.apiextensions.CustomResource(
    "kong-plugin-require-vpn",
    k8s.apiextensions.CustomResourceArgs(
        api_version="configuration.konghq.com/v1",
        kind="KongPlugin",
        metadata=k8s.meta.v1.ObjectMetaArgs(
            name="require-vpn",
            namespace="default",
        ),
        spec={
            "config": {
                "allow": [vpn_gateway_ip],
            },
        },
        plugin="ip-restriction",
    ),
    opts=pulumi.ResourceOptions(
        provider=k8s_provider,
    ),
)
