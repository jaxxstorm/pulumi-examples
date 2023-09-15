import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

const randomString = new random.RandomString("random", {
    length: 21,
});
