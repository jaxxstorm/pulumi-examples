using Pulumi;
using Pulumi.Kubernetes.Core.V1;
using Pulumi.Kubernetes.Helm;
using Pulumi.Kubernetes.Helm.V2;

class HelmChart : Stack
{
    public HelmChart()
    {

        // Get some configuration values
        var config = new Config();
        var configNs = config.Require("namespace");

        // Create a namespace
        var ns = new Namespace(configNs);
        var namespaceName = ns.Metadata.Apply(n => n.Name); // Get's the namespace _name_ from the metadata

        var chart = new Chart("cert-manager", new ChartArgs
        {
            Chart = "cert-manager",
            Namespace = namespaceName,
            FetchOptions = new ChartFetchArgs
            {
                Repo = "https://charts.jetstack.io" // Note: this needs a patch version of pulumi-kubernetes
            }
        }
        );

    }


}
