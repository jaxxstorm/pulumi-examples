import * as pulumi from "@pulumi/pulumi";
import * as vcn from "./vcn";
import * as oci from "@pulumi/oci";
import * as init from "@pulumi/cloudinit";

const compartment = oci.identity.getCompartmentOutput({
  id: "ocid1.tenancy.oc1..aaaaaaaavh67gfytloujvijdue6pqwhfrlo2ms4jbkpozyez7sgdhf27e4yq",
});

const okeVcn = new vcn.OciVcn("example", {
  cidrBlock: "172.16.0.0/22",
  compartmentId: compartment.id,
  createInternetGateway: true,
  createNatGateway: true,
  createServiceGateway: true,
});

const kubeVersion = "v1.24.1";

const cluster = new oci.containerengine.Cluster("example", {
  compartmentId: compartment.id,
  vcnId: okeVcn.vcn.id,
  kubernetesVersion: kubeVersion,
  options: {
    serviceLbSubnetIds: okeVcn.publicSubnetIds,
  },
  endpointConfig: {
    isPublicIpEnabled: true,
    subnetId: okeVcn.publicSubnetIds[0],
  },
});

const sl = new oci.core.SecurityList("example", {
  compartmentId: compartment.id,
  vcnId: okeVcn.vcn.id,
  egressSecurityRules: [
    {
      destination: "0.0.0.0/0",
      protocol: "all",
      stateless: false,
      description: "allow all traffic to the internet",
    },
  ],
  ingressSecurityRules: [
    {
      description: "allow all traffic inside the VCN",
      protocol: "all",
      stateless: false,
      source: okeVcn.vcn.cidrBlock,
    },
    {
      description: "allow access to OKE control plane",
      protocol: "6",
      stateless: false,
      source: "0.0.0.0/0",
    },
  ],
});

const kubeconfigOutput = oci.containerengine.getClusterKubeConfigOutput({
  clusterId: cluster.id,
});

export const kubeconfig = kubeconfigOutput.content;

let availDomains = oci.identity.getAvailabilityDomainsOutput({
  compartmentId: compartment.id,
});

export const availabilityDomains = availDomains.availabilityDomains;

const imageId = "ocid1.image.oc1.phx.aaaaaaaaxmrdfmxqn2vdm5fawepynsgklnthansysonqkvr2odhzxx5w4awa";

const workerUserData = init.getConfigOutput({
    gzip: false,
    base64Encode: true,
    parts: [{
        filename: "worker.sh",
        contentType: "text/x-shellscript",
        content: `
        #!/bin/bash

# DO NOT MODIFY
curl --fail -H "Authorization: Bearer Oracle" -L0 http://169.254.169.254/opc/v2/instance/metadata/oke_init_script | base64 --decode >/var/run/oke-init.sh

## run oke provisioning script
bash -x /var/run/oke-init.sh

### adjust block volume size
/usr/libexec/oci-growfs -y

touch /var/log/oke.done`
    }]
})

const pool = new oci.containerengine.NodePool("example", {
    clusterId: cluster.id,
    compartmentId: compartment.id,
    kubernetesVersion: kubeVersion,
    nodeConfigDetails: {
        nodePoolPodNetworkOptionDetails: {
            cniType: "FLANNEL_OVERLAY",
        },
        placementConfigs: [{
            availabilityDomain: availabilityDomains[0].name,
            subnetId: okeVcn.privateSubnetIds[0],
        }],
        size: 1,
    },
    nodeEvictionNodePoolSettings: {
        evictionGraceDuration: "PT1H",
    },
    nodeShape: "VM.Standard.E3.Flex",
    nodeShapeConfig: {
        memoryInGbs: 16,
        ocpus: 1,
    },
    nodeSourceDetails: {
        imageId: imageId,
        sourceType: "IMAGE",
    },
    nodeMetadata: {
        user_data: workerUserData.rendered,
    }
}, { parent: cluster });
