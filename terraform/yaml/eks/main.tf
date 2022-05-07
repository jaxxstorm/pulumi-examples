locals {
    obj = {
    cluster = {
        type = "eks:Cluster"
        properties = {
            vpcId = "$${vpcId}"
            subnetIds = "$${subnetIds}"
            instanceType = "t2.medium"
            desiredCapacity = 2
            minSize = 1
            maxSize = 2
    }
  }
  variables = {
  subnetIds = {
    "Fn::Invoke" = {
      Arguments = {
        vpcId = "$${vpcId}"
      }
      Function = "aws:ec2:getSubnetIds"
      Return = "ids"
    }
  }

    vpcId = {
        "Fn::Invoke" = {
        Arguments = {
            default = true
        }
        Function = "aws:ec2:getVpc"
        Return = "id"
        }
    }
    }
    outputs = {
    kubeconfig = "$${cluster.kubeconfig}"
    }
    }
}
output test {
    value = yamlencode(local.obj)
}