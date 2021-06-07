import * as ingress from "./ingress";

const ing = new ingress.ProductionIngress("example", {
    namespace: "foo",
    host: "foo.example.com",
})