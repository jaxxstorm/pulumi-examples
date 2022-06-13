import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// create a new IAM user
const user = new aws.iam.User("assume-role-test", {})

// create a set of keys to user
const key = new aws.iam.AccessKey("assume-role-test", {
    user: user.name
}, { parent: user })

// create an role that is assumable by other roles
const role = new aws.iam.Role("admin", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "",
        Effect: "Allow",
        Principal: {
          AWS: "*", // Note: this is very permissive, fix this
        },
        Action: "sts:AssumeRole",
      },
    ],
  }),
  managedPolicyArns: [ "arn:aws:iam::aws:policy/AdministratorAccess" ],
});

// now, attach a policy to the user that allows it to assume the admin role
const userPolicy = new aws.iam.Policy("admin", {
    policy: role.arn.apply(arn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: "sts:AssumeRole",
            Resource: arn
        }]
    }))
}, { parent: user })
const userPolicyAttachment = new aws.iam.UserPolicyAttachment("admin", {
    user: user.name,
    policyArn: userPolicy.arn,
}, { parent: userPolicy })


export const accessKey = key.id
export const secretKey = key.secret
export const roleArn = role.arn

// now, make a provider that uses the access key
// then assumes role to an admin provider
const assumeRoleProvider = new aws.Provider("assumeRole", {
    accessKey: key.id,
    secretKey: key.secret,
    assumeRole: {
        roleArn: role.arn,
        sessionName: "pulumiProvider"
    }
}, { dependsOn: [ userPolicyAttachment, role, user ] }) // we need an explicit depends on here :( )

// note, this provider is useless, because it only has sts perms:
// const keyProvider = new aws.Provider("keyProvider", {
//     accessKey: key.id,
//     secretKey: key.secret,
// })

// create an S3 bucket with the admin provider
const bucket = new aws.s3.Bucket("example", {}, {
    provider: assumeRoleProvider, parent: assumeRoleProvider,
})

