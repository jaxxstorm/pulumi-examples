import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface Auth0ClientVpnArgs {

}

export class Auth0ClientVpn extends pulumi.ComponentResource {



    constructor(name: string, args: Auth0ClientVpnArgs, opts?: pulumi.ComponentResourceOptions) {
        super("jaxxstorm:index:Auth0ClientVpn", name, {}, opts);

        

    }

}