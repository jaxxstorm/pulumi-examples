import * as pulumi from "@pulumi/pulumi";
import * as tls from "@pulumi/tls";


// create a CA private key
const caKey = new tls.PrivateKey("ca", {
    algorithm: "RSA",
    ecdsaCurve: "P256",
    rsaBits: 2048,
})

// create a CA certificate
const caCert = new tls.SelfSignedCert("ca", {
    keyAlgorithm: caKey.algorithm,
    privateKeyPem: caKey.privateKeyPem,
    isCaCertificate: true,
    validityPeriodHours: 807660, // 10 years
    allowedUses: [ "key_encipherment",  "digital_signature" ],
    subjects: [{
        commonName: "lbrlabs",
        organization: "lbrlabs LLC"
    }]
}, { parent: caKey })

// Create a certificate private key
const key = new tls.PrivateKey("privateKey", {
    algorithm: "RSA",
    ecdsaCurve: "P256",
    rsaBits: 2048
})

const certRequest = new tls.CertRequest("certRequest", {
    keyAlgorithm: key.algorithm,
    privateKeyPem: key.privateKeyPem,
    dnsNames: [ "web.lbrlabs.com" ], 
    ipAddresses: [ "192.168.0.1" ],
    subjects: [{
        commonName: "web.lbrlabs.com",
        organization: "lbrlabs LLC"
    }]
}, { parent: key })

// sign the cert with the CA certificate key
const cert = new tls.LocallySignedCert("cert", {
    certRequestPem: certRequest.certRequestPem,
    caKeyAlgorithm: caKey.algorithm,
    caPrivateKeyPem: caKey.privateKeyPem,
    caCertPem: caCert.certPem,
    validityPeriodHours: 17520,
    allowedUses: [ "key_encipherment",  "digital_signature" ],
}, { parent: certRequest })

export const certificate = {
    pem: cert.certPem,
    privateKey: key.privateKeyPem,
    caCert: cert.caCertPem
}


