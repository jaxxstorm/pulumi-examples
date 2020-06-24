import pulumi
import pulumi_kubernetes as k8s
import pulumi_kubernetes.helm.v3 as helm
from pulumi_kubernetes.core.v1 import Namespace

# Get configuration options
config = pulumi.Config()
namespace = config.require("namespace")
clusterProject = config.require("clusterProject")


# Get the stack
stack = pulumi.get_stack()
sr = "jaxxstorm/{}/{}".format(clusterProject, stack)
stack_ref = pulumi.StackReference(sr)
# Get the kubeconfig from the stack
kubeconfig = stack_ref.get_output("kubeConfig")



# Set up the provider
provider = k8s.Provider(
    "home.lbrlabs",
    kubeconfig=kubeconfig
)

# Create the namespace
ns = Namespace("ns", metadata={
    "name": namespace,
    },
    opts=pulumi.ResourceOptions(provider=provider),

)

# Install the helm chart
helm.Chart("traefik", helm.ChartOpts(
    namespace=ns.metadata["name"],
    chart="traefik",
    fetch_opts=helm.FetchOpts(
        repo='https://containous.github.io/traefik-helm-chart',
    ),
))
