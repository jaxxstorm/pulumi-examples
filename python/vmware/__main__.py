import pulumi
import pulumi_vsphere as vsphere
from pulumi_vsphere import resource_pool

stack_name = pulumi.get_stack()

# datacenter_name = "/Datacenter"

datacenter = vsphere.Datacenter.get(stack_name, id="/dc01")

datastore = datacenter.moid.apply(
    lambda id: vsphere.get_datastore(datacenter_id=id, name="datastore1"))

network = datacenter.moid.apply(lambda id: vsphere.get_network(
    datacenter_id=id,
    name="VM Network",
))

cluster = datacenter.moid.apply(lambda id: vsphere.get_compute_cluster(
    name="test-00d4628",
    datacenter_id=datacenter.moid
))

vm_template = datacenter.moid.apply(lambda id: vsphere.get_virtual_machine(
    datacenter_id=id,
    name="linux",
))

vm = vsphere.VirtualMachine(
    stack_name,
    resource_pool_id=cluster.resource_pool_id,
    # datacenter_id=datacenter.id,
    datastore_id=datastore.id,
    guest_id=vm_template.guest_id,
    num_cpus=1,
    memory=2048,
    network_interfaces=[
        vsphere.VirtualMachineNetworkInterfaceArgs(
            network_id=network.id,
            adapter_type=vm_template.network_interface_types[0],
        )
    ],
    disks=[
        vsphere.VirtualMachineDiskArgs(
            label="disk0",
            size=vm_template.disks[0].size,
            eagerly_scrub=vm_template.disks[0].eagerly_scrub,
            thin_provisioned=vm_template.disks[0].thin_provisioned,
        )
    ],
    clone=vsphere.VirtualMachineCloneArgs(
        template_uuid=vm_template.id,
    ),
)

# pulumi.export("datacenter", datacenter)
# pulumi.export("datastore", datastore)
# pulumi.export("network", network)
# pulumi.export("vm_template", vm_template)
