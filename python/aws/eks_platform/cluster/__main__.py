"""An AWS Python Pulumi program"""

import pulumi
import pulumi_eks as eks

stack = pulumi.get_stack()
stack_ref = pulumi.StackReference("jaxxstorm/python_eks_platform_vpc/dev")

public_subnets = stack_ref.require_output("public_subnet_ids")
private_subnets = stack_ref.require_output("private_subnet_ids")
vpc_id = stack_ref.require_output("vpc_id")

# this returns a list, I can access the list to print like so
# public_subnets.apply(lambda id: print(id))

cluster = eks.Cluster(
    "python-eks-cluster",
    vpc_id=vpc_id,
    private_subnet_ids=private_subnets,
)

