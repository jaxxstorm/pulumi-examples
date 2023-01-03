#!/usr/bin/env nu

let resources = {
    cluster: {
        type: 'eks:Cluster',
        properties: {
            vpcId: "${vpcId}",
            subnetIds: "${subnetIds}",
            instanceType: "t2.medium",
            desiredCapacity: 2,
            minSize: 1,
            maxSize: 2
        }
    }
}

let variables = {
    subnetIds: {
        "Fn::Invoke": {
            Arguments: {
                vpcId: "${vpcId}"
            },
            Function: "aws:ec2:getSubnetIds",
            Return: "ids"
        }
    }
    vpcId: {
        "Fn::Invoke": {
            Arguments: {
                default: true
            }
            Function: 'aws:ec2:getVpc',
            Return: 'id'
        }
    }
}

let outputs = {
    kubeconfig: '${cluster.kubeconfig}'
}

let pulumi = {
    name: 'aws-eks',
    runtime: 'yaml',
    description: 'An EKS cluster'
    variables: $variables,
    resources: $resources,
    outputs: $outputs
}

$pulumi
| to yaml