"""A Python Pulumi program"""

import pulumi
import pulumi_kubernetes as k8s


# removes the status field from the nginx-ingress crd
def remove_status(obj):
    if 'status' in obj:
        try:
            del obj["status"]
        except KeyError:
            pass

clusters = [
    "cluster-1",
    "cluster-2",
    "cluster-3"
]

for cluster in clusters:
    chart = k8s.helm.v3.Chart(
        release_name="consul",
        config=k8s.helm.v3.ChartOpts(
            resource_prefix=cluster,
            chart="consul",
            namespace="default",
            values={},
            fetch_opts=k8s.helm.v3.FetchOpts(
                repo="https://helm.releases.hashicorp.com",
            ),
            transformations=[remove_status],
        ) 
    )
