import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as fs from 'fs';

// define a VPC
const vpc = new awsx.ec2.Vpc(`example`, {
    numberOfAvailabilityZones: 1,
    numberOfNatGateways: 1,
    cidrBlock: "172.16.0.0/24",
    subnets: [
        {type: "private", tags: {Name: "example-private"}},
        {type: "public", tags: {Name: "example-public"}}
    ],
    tags: {
        tier: "production",
        Name: "example"
    }
});

// create an IAM role so instances can call the EC2 api
const iamRole = new aws.iam.Role(`example-web-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
    }),
})

const managedPolicyArns: string[] = [
    'arn:aws:iam::aws:policy/AmazonEC2FullAccess',
    'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
]

/*
  Loop through the managed policies and attach
  them to the defined IAM role
*/
let counter = 0;
for (const policy of managedPolicyArns) {
    // Create RolePolicyAttachment without returning it.
    const rpa = new aws.iam.RolePolicyAttachment(`example-policy-${counter++}`,
        { policyArn: policy, role: iamRole.id }, { parent: iamRole }
    );
}

/*
  Define some custom policies for the role. This allows access to cloudwatch
  for adding metric data and logs
*/
const cloudwatchPolicy = new aws.iam.RolePolicy('example-cloudwatch-rp', {
    role: iamRole.id,
    policy: {
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "cloudwatch:PutMetricData",
                "ec2:DescribeVolumes",
                "ec2:DescribeTags",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams",
                "logs:DescribeLogGroups",
                "logs:CreateLogStream",
                "logs:CreateLogGroup"
            ],
            Effect: "Allow",
            Resource: "*",
        }],
    },
});

/*
  The role for SSM, which allows the instances to register in SSM
*/
const ssmRolePolicy = new aws.iam.RolePolicy('example-ssm-rp', {
    role: iamRole.id,
    policy: {
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "ssm:PutParameter"
            ],
            Effect: "Allow",
            Resource: "arn:aws:ssm:*:*:parameter/AmazonCloudWatch-* ",
        }],
    },
});

const instanceProfile = new aws.iam.InstanceProfile('example-web-instanceprofile', {
    role: iamRole.name
})

/*
  This grabs the AMI asynchronously so we can use it to pass to the launchtemplate etc
*/
const ami = pulumi.output(aws.ec2.getAmi({
    filters: [
        { name: "name", values: [ "amzn-ami-hvm-*-x86_64-ebs" ] }
    ],
    owners: ["137112412989"],
    mostRecent: true
}))

/*
  Define a security group for the ec2 instances.
  We allow egress all, and we also allow access to all ports from within the VPC subnet
  We notably don't allow SSH access, because we use AWS SSM for that instead
*/
const instanceSecurityGroups = new aws.ec2.SecurityGroup('example-instance-securitygroup', {
    vpcId: vpc.id,
    description: "Allow all ports from same subnet",
    ingress: [{
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: [ "172.16.0.0/24"  ]
    }],
    egress: [{
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
    }]
})

/*
  This defines the userdata for the instances on startup.
  We read the file async, and then convert to a Base64 string because it's clean in the metadata
*/
let userDataRaw = fs.readFileSync('./files/userdata.sh')
let userData = Buffer.from(userDataRaw).toString('base64')

/*
  This is the launch template for the instances
*/
const launchTemplate = new aws.ec2.LaunchTemplate('example-web-launchtemplate', {
    imageId: ami.id,
    instanceType: "t3.small",
    namePrefix: "example",
    keyName: "lbriggs",
    networkInterfaces: [{
        deleteOnTermination: "true",
        securityGroups: [ instanceSecurityGroups.id ],
    }],
    monitoring: {
        enabled: true
    },
    iamInstanceProfile: {
        arn: instanceProfile.arn
    },
    blockDeviceMappings: [{
        deviceName: "/dev/xvda",
        ebs: {
            volumeSize: 8,
            deleteOnTermination: "true",
            volumeType: "gp2",
        }
    }],
    userData: userData
})

const webSecurityGroup = new aws.ec2.SecurityGroup('example-web-securitygroup', {
    vpcId: vpc.id,
    description: "Allow all web traffic",
    ingress: [{
        protocol: 'tcp',
        fromPort: 80,
        toPort: 80,
        cidrBlocks: [ '0.0.0.0/0'],
    }, {
        protocol: 'tcp',
        fromPort: 443,
        toPort: 443,
        cidrBlocks: [ '0.0.0.0/0' ],
    }],
    egress: [{
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
    }]
})

const loadbalancer = new aws.elb.LoadBalancer('example-web-lb', {
    listeners: [
        {
            instancePort: 80,
            instanceProtocol: "http",
            lbPort: 80,
            lbProtocol: "http",
        },
    ],
    securityGroups: [ webSecurityGroup.id ],
    subnets: vpc.publicSubnetIds,
    connectionDraining: true,
    connectionDrainingTimeout: 300,
    healthCheck: {
        healthyThreshold: 2,
        unhealthyThreshold: 2,
        timeout: 10,
        target: "TCP:80", // We should try use a HTTP check rather than TCP here
        interval: 30,
    }
})

/*
  We define a cloudformation template for the autoscaling group.
  The only reason we do this is because CFN allows rolling updates of the ASG when we
  make changes to the AMI. If the instance refresh API is ever merged, we should remove this.
  NOTE: this is just a standard map, so we need to use an output when we references this
  as we have a bunch of outputs in here
*/
const cfnTemplate = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Main example ASG',
    Resources: {
        "example": {
            Type: 'AWS::AutoScaling::AutoScalingGroup',
            UpdatePolicy: {
                AutoScalingRollingUpdate: {
                    MaxBatchSize: "1",
                    MinInstancesInService: "1",
                    PauseTime: "PT10M",
                    // WaitOnResourceSignals: "true",
                }
            },
            Properties: {
                VPCZoneIdentifier: vpc.privateSubnetIds,
                MaxSize: 10,
                MinSize: 1,
                MetricsCollection: [
                    {
                        "Granularity":"1Minute",
                        "Metrics":[
                            "GroupDesiredCapacity",
                        ],
                    },
                ],
                LoadBalancerNames: [ loadbalancer.name ],
                Cooldown: 300,
                HealthCheckType: "ELB",
                HealthCheckGracePeriod: 100,
                MixedInstancesPolicy: {
                    InstancesDistribution: {
                        OnDemandBaseCapacity: 1,
                        OnDemandPercentageAboveBaseCapacity: 50,
                    },
                    LaunchTemplate: {
                        LaunchTemplateSpecification: {
                            LaunchTemplateId: launchTemplate.id,
                            Version: launchTemplate.latestVersion,
                        },
                    }
                },
                Tags: [{
                    Key: "ManagedBy",
                    PropagateAtLaunch: true,
                    Value: "pulumi",
                }, {
                    Key: "Name",
                    PropagateAtLaunch: true,
                    Value: 'example'
                }],
            }
        }
    },
    // Outputs: {
    //     AsgName: {
    //         Description: "The name of the created autoscaling group",
    //         Value: {
    //             Ref: 'example'
    //         }
    //     }
    // }
}

/*
  Create the cloudformation stack for the autoscaling group
  As mentioned above, we take the above JSON map, stringify it and then run it through
  an output so we can resolve the promise references above
*/
const cfnAutoScalingGroup = new aws.cloudformation.Stack('example-web-cfn', {
    templateBody: pulumi.output(cfnTemplate).apply(JSON.stringify)
}, { dependsOn: [ launchTemplate ]}  )

/*
  A target tracking autoscaling policy
   We have to reference the stackouput.
   We check the CPU util of the instances in the ASG, if it hits 85%
   we scale up
 */
//    const scaleUp = new aws.autoscaling.Policy('example-scalingpolicy', {
//     autoscalingGroupName: cfnAutoScalingGroup.outputs.apply(x => x["AsgName"]),
//     policyType: "TargetTrackingScaling",
//     estimatedInstanceWarmup: 180,
//     targetTrackingConfiguration: {
//         predefinedMetricSpecification: {
//             predefinedMetricType: "ASGAverageCPUUtilization"
//         },
//         targetValue: 85.0
//     }
// })

export const address = loadbalancer.dnsName

