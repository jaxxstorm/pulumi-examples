import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as k8s from "@pulumi/kubernetes";

let config = new pulumi.Config()
const stack = pulumi.getStack()
const eks = new pulumi.StackReference(`jaxxstorm/eks.ts/${stack}`);
const clusterOidcProvider = eks.getOutput("clusterOidcProvider")
const clusterOidcProviderArn = eks.getOutput("clusterOidcProviderArn")
const clusterName = eks.getOutput("clusterName")

const vpc = new pulumi.StackReference(`jaxxstorm/vpc.ts/${stack}`);
const vpcId = vpc.getOutput("vpcId")


const provider = new k8s.Provider("k8s", {kubeconfig: eks.getOutput("kubeconfig")});

const saAssumeRolePolicy = pulumi
    .all([clusterOidcProvider, clusterOidcProviderArn])
    .apply(([url, arn]) =>
        aws.iam.getPolicyDocument({
            statements: [
                {
                    actions: ['sts:AssumeRoleWithWebIdentity'],
                    conditions: [
                        {
                            test: 'StringEquals',
                            values: [`system:serviceaccount:kube-system:aws-alb-ingress-controller`],
                            variable: `${url.replace('https://', '')}:sub`,
                        },
                    ],
                    effect: 'Allow',
                    principals: [{identifiers: [arn], type: 'Federated'}],
                },
            ],
        })
    );

const role = new aws.iam.Role("alb-ingress-controller", {
    assumeRolePolicy: saAssumeRolePolicy.json
});

const albPolicy = new aws.iam.Policy("alb", {
    policy: {
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "acm:DescribeCertificate",
                "acm:ListCertificates",
                "acm:GetCertificate"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:CreateSecurityGroup",
                "ec2:CreateTags",
                "ec2:DeleteTags",
                "ec2:DeleteSecurityGroup",
                "ec2:DescribeAccountAttributes",
                "ec2:DescribeAddresses",
                "ec2:DescribeInstances",
                "ec2:DescribeInstanceStatus",
                "ec2:DescribeInternetGateways",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeTags",
                "ec2:DescribeVpcs",
                "ec2:ModifyInstanceAttribute",
                "ec2:ModifyNetworkInterfaceAttribute",
                "ec2:RevokeSecurityGroupIngress"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "elasticloadbalancing:AddListenerCertificates",
                "elasticloadbalancing:AddTags",
                "elasticloadbalancing:CreateListener",
                "elasticloadbalancing:CreateLoadBalancer",
                "elasticloadbalancing:CreateRule",
                "elasticloadbalancing:CreateTargetGroup",
                "elasticloadbalancing:DeleteListener",
                "elasticloadbalancing:DeleteLoadBalancer",
                "elasticloadbalancing:DeleteRule",
                "elasticloadbalancing:DeleteTargetGroup",
                "elasticloadbalancing:DeregisterTargets",
                "elasticloadbalancing:DescribeListenerCertificates",
                "elasticloadbalancing:DescribeListeners",
                "elasticloadbalancing:DescribeLoadBalancers",
                "elasticloadbalancing:DescribeLoadBalancerAttributes",
                "elasticloadbalancing:DescribeRules",
                "elasticloadbalancing:DescribeSSLPolicies",
                "elasticloadbalancing:DescribeTags",
                "elasticloadbalancing:DescribeTargetGroups",
                "elasticloadbalancing:DescribeTargetGroupAttributes",
                "elasticloadbalancing:DescribeTargetHealth",
                "elasticloadbalancing:ModifyListener",
                "elasticloadbalancing:ModifyLoadBalancerAttributes",
                "elasticloadbalancing:ModifyRule",
                "elasticloadbalancing:ModifyTargetGroup",
                "elasticloadbalancing:ModifyTargetGroupAttributes",
                "elasticloadbalancing:RegisterTargets",
                "elasticloadbalancing:RemoveListenerCertificates",
                "elasticloadbalancing:RemoveTags",
                "elasticloadbalancing:SetIpAddressType",
                "elasticloadbalancing:SetSecurityGroups",
                "elasticloadbalancing:SetSubnets",
                "elasticloadbalancing:SetWebAcl"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "iam:CreateServiceLinkedRole",
                "iam:GetServerCertificate",
                "iam:ListServerCertificates"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "cognito-idp:DescribeUserPoolClient"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "waf-regional:GetWebACLForResource",
                "waf-regional:GetWebACL",
                "waf-regional:AssociateWebACL",
                "waf-regional:DisassociateWebACL",
                "waf:GetWebACL",
                "wafv2:GetWebACL",
                "wafv2:GetWebACLForResource",
                "wafv2:AssociateWebACL",
                "wafv2:DisassociateWebACL"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "tag:GetResources",
                "tag:TagResources"
            ],
            Effect: "Allow",
            Resource: "*",
        }, {
            Action: [
                "shield:DescribeProtection",
                "shield:GetSubscriptionState",
                "shield:DeleteProtection",
                "shield:CreateProtection",
                "shield:DescribeSubscription",
                "shield:ListProtections"
            ],
            Effect: "Allow",
            Resource: "*",
        }],
    },
})

const albPolicyAttachment = new aws.iam.RolePolicyAttachment("alb", {
    role: role,
    policyArn: albPolicy.arn,
})

// set up nginx-ingress
const ingressController = new k8s.helm.v2.Chart("aws-alb-ingress-controller",
    {
        namespace: "kube-system",
        chart: "aws-alb-ingress-controller",
        fetchOpts: {repo: "http://storage.googleapis.com/kubernetes-charts-incubator"},
        values: {
            awsVpcID: vpcId,
            awsRegion: "us-west-2",
            clusterName: clusterName,
            rbac: {
                serviceAccount: {
                    annotations: {
                        "eks.amazonaws.com/role-arn": role.arn
                    },
                },
            },
        },
    },
    {providers: {kubernetes: provider}},
)


