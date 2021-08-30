import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";

export interface ReservedNodeGroupArgs {
    kubeReservedMemory: string
    systemReservedMemory: string
    nodeSubnetIds: Promise<pulumi.Input<string>[]>
    cluster: eks.Cluster
}

export class ReservedNodeGroup extends pulumi.ComponentResource {

  constructor(name: string, args: ReservedNodeGroupArgs, opts: pulumi.ComponentResourceOptions = {}) {
    super("jaxxstorm:index:ReservedNodeGroup", name, {}, opts);

    // JSON format extra configuration
    const kubeletExtraConfig = JSON.stringify({
      kubeReserved: {
        memory: args.kubeReservedMemory,
      },
      kubeReservedCgroup: "/kube-reserved",
      systemReserved: {
        memory: args.systemReservedMemory,
      },
      evictionHard: {
        "memory.available": "50Mi",
      },
      featureGates: {
        DynamicKubeletConfig: true,
      },
      maxPods: 12,
    });

    // write out the JSON configured extra args, then splat them with jq
    // once that's done, override the existing kubelet-config and restart it
    const extraUserData = `
echo '${kubeletExtraConfig}' > /tmp/kubeletExtraConfig
jq -s '.[0] * .[1]' "/etc/kubernetes/kubelet/kubelet-config.json" /tmp/kubeletExtraConfig > /tmp/renderedKubeConfig
mv /tmp/renderedKubeConfig /etc/kubernetes/kubelet/kubelet-config.json
service kubelet restart
`;

    const group = new eks.NodeGroup(`${name}-reservedNodeGroup`, {
      cluster: args.cluster,
      instanceType: "t3a.small",
      desiredCapacity: 1,
      nodeSubnetIds: args.nodeSubnetIds,
      nodeUserData: extraUserData,
      labels: {
        "lbrlabs.com/reserved": "true",
      },
      autoScalingGroupTags: {
        "k8s.io/cluster-autoscaler/enabled": "true",
        [`k8s.io/cluster-autoscaler/${name}`]: "true",
      },
      keyName: "lbriggs",
    }, { parent: this });
  }
}
