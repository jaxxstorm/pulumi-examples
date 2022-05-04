program pulumi

   use,intrinsic :: iso_fortran_env, only: wp => real64
   use json_module

   implicit none

   type(json_core) :: json
   type(json_value),pointer :: p, inp
   type(json_value), pointer :: resources, cluster, properties
   type(json_value), pointer :: variables, vpcId, subnetIds
   type(json_value), pointer :: vpcInvoke, vpcInvokeArguments
   type(json_value), pointer :: subnetInvoke, subnetInvokeArguments

   ! initialize the class
   call json%initialize()

   ! initialize the structure:
   call json%create_object(p,'')

   ! create root object
   call json%create_object(inp,'inputs')
   call json%add(p, inp) !add it to the root

   ! create the variables object
   call json%create_object(variables, 'variables')
   call json%add(inp, variables)

   ! create the vpc variable object
   call json%create_object(vpcId, 'vpcId')
   call json%add(variables, vpcId)
   call json%create_object(vpcInvoke, 'Fn::Invoke')
   call json%add(vpcId, vpcInvoke)
   call json%add(vpcInvoke, 'Function', 'aws:ec2:getVpc')
   call json%create_object(vpcInvokeArguments, 'Arguments')
   call json%add(vpcInvoke, vpcInvokeArguments)
   call json%add(vpcInvokeArguments, 'default', 'true')
   call json%add(vpcInvoke, 'Return', 'id')

   ! create the subnet ids variable object
   call json%create_object(subnetIds, 'subnetIds')
   call json%add(variables, subnetIds)
   call json%create_object(subnetInvoke, 'Fn::Invoke')
   call json%add(subnetIds, subnetInvoke)
   call json%add(subnetInvoke, 'Function', 'aws:ec2:getSubnetIds')
   call json%create_object(subnetInvokeArguments, 'Arguments')
   call json%add(subnetInvoke, subnetInvokeArguments)
   call json%add(subnetInvokeArguments, 'vpcId', '${vpcId}')
   call json%add(subnetInvoke, 'Return', 'ids')

   ! create the resources object
   call json%create_object(resources, 'resources')
   call json%add(inp, resources) ! add to root object

   ! create the cluster object
   call json%create_object(cluster, 'cluster')
   call json%add(resources, cluster) ! add cluster to resources
   call json%add(cluster, 'type', 'eks:Cluster') ! set the resource type

   ! create the resource properties object
   call json%create_object(properties, 'properties')
   call json%add(cluster, properties)
   call json%add(properties, 'vpcId', '${vpcId}')
   call json%add(properties, 'subnetIds', '${subnetIds}')
   call json%add(properties, 'instanceType', 't2.medium')
   call json%add(properties, 'desiredCapacity', 2)
   call json%add(properties, 'minSize', 1)
   call json%add(properties, 'maxSize', 2)

   ! write the file:
   call json%print(inp)

end program pulumi

