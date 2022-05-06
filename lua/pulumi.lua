---
--- Created by dirien.
--- DateTime: 06.05.22 21:43
---
aws = {
    ["variables"] = {},
    ["resources"] = {},
    ["outputs"] = {}
}

function outputs(outputs,name,value)
    outputs[name] = value
end

function createVariable(variables, name, fn, argument)
    variables[name] = {
        ["Fn::Invoke"] = {
            ["Function"] = fn,
            ["Arguments"] = argument,
            ["Return"] = "id"
        }
    }
end

function createCluster(resource, minSize, maxSize, desiredCapacity, instanceType)
    resource["cluster"] = {
        ["type"] = "eks:Cluster",
        ["properties"] = {
            ["vpcId"] = "${vpcId}",
            ["subnetIds"] = "${subnetIds}",
            ["instanceType"] = instanceType,
            ["desiredCapacity"] = desiredCapacity,
            ["minSize"] = minSize,
            ["maxSize"] = maxSize
        }
    }
end
createVariable(aws["variables"], "vpcId", "aws:ec2:getVpc", {
    ["default"] = "true"
})
createVariable(aws["variables"], "subnetIds", "aws:ec2:getSubnetIds", {
    ["vpcId"] = "${vpcId}"
})
createCluster(aws["resources"], 1, 2, 2, "t2.medium")
outputs(aws["outputs"], "kubeconfig", "${cluster.kubeconfig}")


function createPulumi (tbl, indent)
    if not indent then
        indent = 0
    end
    for k, v in pairs(tbl) do
        formatting = string.rep("  ", indent) .. k .. ": "
        if type(v) == "table" then
            print(formatting)
            createPulumi(v, indent + 1)
        else
            print(formatting .. v)
        end
    end
end

createPulumi(aws)
