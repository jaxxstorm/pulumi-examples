use YAML 'Dump';

my @pulumi = {
    variables => {
        vpcId => {
            "Fn::Invoke" => {
                Function => "aws:ec2:getVpc",
                Arguments => {
                    default => true
                },
                Return => "id"
            }
        },
        subnetIds => {
            "Fn::Invoke" => {
                Function => "aws:ec2:getSubnetIds",
                Arguments => {
                    vpcId => "\${vpcId}"
                },
                Return => "ids"
            }
        }
    },
    resources => {
        cluster => {
            type => "eks:Cluster",
            properties => {
                vpcId => "\${vpcId}",
                subnetIds => "\${subnetIds}",
                instanceType => "t2.medium",
                desiredCapacity => 2,
                minSize => 1,
                maxSize => 2,
            }
        }
    },
    outputs => {
        kubeconfig => "\${cluster.kubeconfig}"
    }
};

print Dump( @pulumi );