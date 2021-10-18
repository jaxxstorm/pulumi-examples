import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from 'fs';
const path = require('path');

const policyDocument = fs.readFileSync(path.resolve(__dirname, 'policy.json'), 'utf8');

const jobPolicy = new aws.iam.Policy('file-policy', {
    policy: policyDocument
  });
