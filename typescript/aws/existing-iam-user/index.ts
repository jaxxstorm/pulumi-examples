import * as pulumi from "@pulumi/pulumi";
import * as role from './userrole'

const foo = new role.ExistingUserRole("somebody", {
    username: "somebody@pulumi.com"
})
