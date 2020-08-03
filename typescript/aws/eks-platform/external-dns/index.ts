import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as k8s from "@pulumi/kubernetes";

let config = new pulumi.Config()
const stack = pulumi.getStack()
const eks = new pulumi.StackReference(`jaxxstorm/eks.ts/${stack}`);
const clusterOidcProvider = eks.getOutput("clusterOidcProvider")
const clusterOidcProviderArn = eks.getOutput("clusterOidcProviderArn")

// FIXME: get the role name rather than hard coding it
// const role = aws.iam.Role.get("role", fargateExecutionRoleArn)

const provider = new k8s.Provider("k8s", { kubeconfig: eks.getOutput("kubeconfig") });

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
                            values: [`system:serviceaccount:kube-system:external-dns`],
                            variable: `${url.replace('https://', '')}:sub`,
                        },
                    ],
                    effect: 'Allow',
                    principals: [{identifiers: [arn], type: 'Federated'}],
                },
            ],
        })
    );

const role = new aws.iam.Role("route53", {
    assumeRolePolicy: saAssumeRolePolicy.json
});

const route53Policy = new aws.iam.Policy("route53", {
    policy: {
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "route53:ChangeResourceRecordSets",
            ],
            Effect: "Allow",
            Resource: "arn:aws:route53:::hostedzone/*",
        }, {
            Action: [
                "route53:ListHostedZones",
                "route53:ListResourceRecordSets",
            ],
            Effect: "Allow",
            Resource: "*",
        }],
    },
})

const route53PolicyAttachment = new aws.iam.RolePolicyAttachment("route53", {
    role: role,
    policyArn: route53Policy.arn,
})

// set up nginx-ingress
const externalDns = new k8s.helm.v2.Chart("external-dns",
    {
        namespace: "kube-system",
        chart: "external-dns",
        fetchOpts: { repo: "https://charts.bitnami.com/bitnami" },
        values: {
            aws: {
                region: "us-west-2",
                zoneType: "public",
            },
            serviceAccount: {
                annotations: {
                    "eks.amazonaws.com/role-arn": role.arn,
                }
            }
        }
    },
    { providers: { kubernetes: provider } },
)


