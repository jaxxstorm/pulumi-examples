import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as cloudinit from "@pulumi/cloudinit";

const ami = pulumi.output(aws.ec2.getAmi({
    filters: [
        { name: "name", values: [ "amzn2-ami-ecs-hvm*x86_64*" ] }
    ],
    owners: ["amazon"],
    mostRecent: true
}))

const vpc = new awsx.ec2.Vpc("ecs-example", {
    cidrBlock: "172.16.0.0/24",
    tags: {
        "Owner": "lbriggs",
    }
})

const cluster = new awsx.ecs.Cluster("ecs-example", {
    vpc: vpc,
    tags: {
        "Name": "ecs-example",
        "Owner": "lbriggs"
    },
});

const userData = cluster.cluster.id.apply(id => cloudinit.getConfig({
    gzip: false,
    base64Encode: false,
    parts: [{
        contentType: "text/cloud-config",
        content: JSON.stringify({
            packages: [
                "aws-cfn-bootstrap",
                "aws-cli",
                "ec2-instance-connect",
            ],
            mounts: ['/dev/xvdb', 'none', 'swap', 'sw', '0', '0'],
            bootcmd: [
                "mkswap /dev/xvdb",
                "swapon /dev/xvdb",
                `echo ECS_CLUSTER=\"${id}\" >> /etc/ecs/ecs.config`,
                "echo ECS_ENGINE_AUTH_TYPE=docker >> /etc/ecs/ecs.config",
                "echo ECS_ENABLE_CONTAINER_METADATA=true >> /etc/ecs/ecs.config",
            ],
            runcmd: [
                "yum update --security",
            ]
        })
    }, 
    {
        contentType: "text/x-shellscript",
        content: `
        # Knock one letter off of availability zone to get region.
        AWS_REGION=$(curl -s 169.254.169.254/2016-09-02/meta-data/placement/availability-zone | sed 's/.$//')
        # cloud-init docs are unclear about whether $INSTANCE_ID is available in runcmd.
        EC2_INSTANCE_ID=$(curl -s 169.254.169.254/2016-09-02/meta-data/instance-id)
        # \$ below so we don't get Javascript interpolation.
        # Line continuations are processed by Javascript before YAML or shell sees them.
        CFN_STACK=$(aws ec2 describe-instances \
            --instance-id "\${EC2_INSTANCE_ID}" \
            --region "\${AWS_REGION}" \
            --query "Reservations[0].Instances[0].Tags[?Key=='aws:cloudformation:stack-name'].Value" \
            --output text)
        CFN_RESOURCE=$(aws ec2 describe-instances \
            --instance-id "\${EC2_INSTANCE_ID}" \
            --region "\${AWS_REGION}" \
            --query "Reservations[0].Instances[0].Tags[?Key=='aws:cloudformation:logical-id'].Value" \
            --output text)
        /opt/aws/bin/cfn-signal \
            --region "\${AWS_REGION}" \
            --stack "\${CFN_STACK}" \
            --resource "\${CFN_RESOURCE}"
        `
    }]
}))

const key = aws.ec2.KeyPair.get(
    "lbriggs", // the name for the Pulumi resource
    "lbriggs", // the keypair name to look up
)

// // create an IAM role
const ecsIAMRole = new aws.iam.Role(`mainRole`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
    }),
})

const instanceProfile = new aws.iam.InstanceProfile(`mainProfile`, {
    role: ecsIAMRole.name
})

new aws.iam.RolePolicyAttachment(`ecsTaskExecPolicy`, {
    role: ecsIAMRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
}, { parent: ecsIAMRole })


new aws.iam.RolePolicyAttachment(`ecsEc2RolePolicy`, {
    role: ecsIAMRole.name,
    policyArn: aws.iam.ManagedPolicies.AmazonEC2ContainerServiceforEC2Role
}, { parent: ecsIAMRole })

new aws.iam.RolePolicyAttachment(`ecsCloudwatchPolicy`, {
    role: ecsIAMRole.name,
    policyArn: aws.iam.ManagedPolicies.CloudWatchFullAccess
}, { parent: ecsIAMRole })

const asg = cluster.createAutoScalingGroup("asg", {
    templateParameters: { minSize: 1 },
    subnetIds: vpc.publicSubnetIds,
    launchConfigurationArgs: { 
        instanceType: "t2.medium"
        //associatePublicIpAddress: true,
        //iamInstanceProfile: instanceProfile.arn,
        //userData: userData.rendered,
        keyName: key.keyName,
        imageId: ami.id,
        rootBlockDevice: {
            volumeSize: 30,
            volumeType: "gp2",
        }
    }, 
});

const nginx = new awsx.ecs.EC2Service("nginx", {
    cluster,
    taskDefinitionArgs: {
        containers: {
            nginx: {
                image: "nginx",
                memory: 128,
                networkListener: { port: 80},
            },
        },
    },
    desiredCount: 2,
});
