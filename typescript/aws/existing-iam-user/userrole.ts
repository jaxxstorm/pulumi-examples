import * as aws from "@pulumi/aws"
import * as pulumi from "@pulumi/pulumi"

export interface ExistingUserRoleArgs {
    username: string;
}

export class ExistingUserRole extends pulumi.ComponentResource  {

    constructor(name: string, args: ExistingUserRoleArgs, opts?: pulumi.ComponentResourceOptions) {
        super("policy:index:ExistingUser", name, opts);

        const user = pulumi.output(aws.iam.getUser({
            userName: args.username
        }))

        // Allow user access to EC2 Describe
        const policy = new aws.iam.UserPolicy(`${name}-policy`, {
            user: user.userName,
            policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Action: ["ec2:Describe*"],
                    Effect: "Allow",
                    Resource: "*",
                }],
            }),
        }, { parent: this })

        // allow Assume role into the ec2 service principal
        const role = new aws.iam.Role(`${name}-role`, {
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    Sid: "",
                    Principal: {
                        Service: "ec2.amazonaws.com",
                    },
                }],
            }),
        }, { parent: this })

        // Allow users to update the password for a defined user
        const policyDocument = new aws.iam.RolePolicy(`${name}-policyAttachment`, {
            role: role.arn,
            policy: pulumi.all([user.userName, user.userId]).apply(
                ([name, id]) => JSON.stringify({
                    Version: "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "AllowViewAccountInfo",
                            "Effect": "Allow",
                            "Action": [
                                "iam:GetAccountPasswordPolicy",
                                "iam:GetAccountSummary"
                            ],
                            "Resource": "*"
                        },
                        {
                            "Sid": "AllowManageOwnPasswords",
                            "Effect": "Allow",
                            "Action": [
                                "iam:ChangePassword",
                                "iam:GetUser"
                            ],
                            "Resource": `arn:aws:iam::*:user/${name}`
                        },
                        {
                            "Sid": "AllowManageOwnAccessKeys",
                            "Effect": "Allow",
                            "Action": [
                                "iam:CreateAccessKey",
                                "iam:DeleteAccessKey",
                                "iam:ListAccessKeys",
                                "iam:UpdateAccessKey"
                            ],
                            "Resource": `arn:aws:iam::*:user/${name}`
                        },
                        {
                            "Sid": "AllowManageOwnSSHPublicKeys",
                            "Effect": "Allow",
                            "Action": [
                                "iam:DeleteSSHPublicKey",
                                "iam:GetSSHPublicKey",
                                "iam:ListSSHPublicKeys",
                                "iam:UpdateSSHPublicKey",
                                "iam:UploadSSHPublicKey"
                            ],
                            "Resource": `arn:aws:iam::*:user/${name}`
                        }
                    ]
                })
            )
        }, { parent: this })
    }

}