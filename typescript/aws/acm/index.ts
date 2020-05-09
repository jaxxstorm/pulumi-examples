import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

let config = new pulumi.Config()

const domain = config.require("domain")

const zone = new aws.route53.Zone("zone", {
    name: domain,
})

let records = ["a", "b", "c"]
let sans = []

for (let record of records) {
    sans.push(`${record}.${domain}`)
}

const cert = new aws.acm.Certificate("test", {
    domainName: domain,
    subjectAlternativeNames: sans.sort(),
    validationMethod: "DNS",
})

let fqdns = [] as any[]

// Loop through all the SAN records, add an extra one for the main domain
for (let i = 0; i < records.length+1 ; i++) {
    const record = new aws.route53.Record(`validationRecord-${i}`, {
        name: cert.domainValidationOptions[i].resourceRecordName,
        records: [cert.domainValidationOptions[i].resourceRecordValue],
        ttl: 60,
        type: cert.domainValidationOptions[i].resourceRecordType,
        zoneId: zone.zoneId!,
    })
    fqdns.push(record.fqdn)
}




const validation = new aws.acm.CertificateValidation("validation", {
    certificateArn: cert.arn,
    validationRecordFqdns: fqdns,
})
