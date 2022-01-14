import * as k8s from "@pulumi/kubernetes";
import * as i13t from "./istioDeployment";
import * as ingress from "./istioIngress";
import * as canary from "./istioCanary";
import * as pulumi from "@pulumi/pulumi";

const istioStack = new pulumi.StackReference("jaxxstorm/istio/dev");
const lb = istioStack.getOutput("lb");
export const address = pulumi.interpolate`http://${lb}/productpage`;

// create a namespace for the sample application
const ns = new k8s.core.v1.Namespace("bookinfo", {
  metadata: {
    name: "bookinfo",
    labels: {
      "istio-injection": "enabled",
    },
  },
});

// deploy details microservice
const details = new i13t.IstioDeployment(
  "details",
  {
    image: "docker.io/istio/examples-bookinfo-details-v1:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    extraEnv: [{ name: "details-version", value: "v1" }],
  },
  { parent: ns }
);

// create the service associated with details microservice
details.createService("details", { port: 9080, namespace: ns.metadata.name });

// deploy ratings microservice
const ratings = new i13t.IstioDeployment(
  "ratings",
  {
    image: "docker.io/istio/examples-bookinfo-ratings-v1:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    extraEnv: [{ name: "ratings-version", value: "v1" }],
  },
  { parent: ns }
);

// create the service associated with ratings microservice
const ratingssvc = ratings.createService("ratings", {
  port: 9080,
  namespace: ns.metadata.name,
});

// deploy version 1 of reviews microservice
const reviews = new i13t.IstioDeployment(
  "reviewsv1",
  {
    image: "docker.io/istio/examples-bookinfo-reviews-v1:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    extraEnv: [{ name: "reviews-version", value: "v1" }],
    appLabel: "reviews",
  },
  { parent: ns }
);
// create the svc associated with reviews microservice
let reviewssvc = reviews.createService("reviews", {
  port: 9080,
  namespace: ns.metadata.name,
});

// deploy product microservice
const productPage = new i13t.IstioDeployment(
  "productpage",
  {
    image: "docker.io/istio/examples-bookinfo-productpage-v1:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    extraEnv: [
      {
        name: "product-version",
        value: "v1",
      },
    ],
  },
  { parent: ns }
);

// create the svc associated with product microservice
const productsvc = productPage.createService("productpage", {
  port: 9080,
  namespace: ns.metadata.name,
});

// create an ingress point for the product page svc, which calls the other microservices
new ingress.IstioIngress(
  "bookinfo",
  {
    namespace: ns.metadata.name,
    host: productsvc.metadata.name,
    http: [
      {
        match: [
          {
            uri: {
              exact: "/productpage",
            },
          },
          {
            uri: {
              prefix: "/static",
            },
          },
          {
            uri: {
              exact: "/login",
            },
          },
          {
            uri: {
              exact: "/logout",
            },
          },
          {
            uri: {
              prefix: "/api/v1/products",
            },
          },
        ],
        route: [
          {
            destination: {
              host: productsvc.metadata.name,
              port: {
                number: 9080,
              },
            },
          },
        ],
      },
    ],
  },
  { parent: ns }
);

// deploy a canary of the reviews service
const reviewsV3 = new i13t.IstioDeployment(
  "reviewsv3",
  {
    image: "docker.io/istio/examples-bookinfo-reviews-v3:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    version: "v3",
    extraEnv: [{ name: "reviews-version", value: "v3" }],
    appLabel: "reviews",
  },
  { parent: ns }
);

// const reviewsV2 = new i13t.IstioDeployment(
//   "reviewsv2",
//   {
//     image: "docker.io/istio/examples-bookinfo-reviews-v2:1.16.2",
//     port: 9080,
//     namespace: ns.metadata.name,
//     version: "v2",
//     extraEnv: [{ name: "reviews-version", value: "v2" }],
//     appLabel: "reviews",
//   },
//   { parent: ns }
// );

/*
 * Deploy a weight service for the reviews service
 * we balance requests between the deployed reviews applications
 * add more to the http input where needed
 */
new canary.WeightedIstioService(
  "reviews",
  {
    namespace: ns.metadata.name,
    host: reviewssvc.metadata.name,
    http: [
      {
        route: [
          {
            destination: {
              host: reviewssvc.metadata.name,
              subset: "v1",
            },
            weight: 90,
          },
          {
            destination: {
              host: reviewssvc.metadata.name,
              subset: "v3",
            },
            weight: 10,
          },
        ],
      },
    ],
    subsets: [
      {
        name: "v1",
        labels: {
          version: "v1",
        },
      },
      {
        name: "v3",
        labels: {
          version: "v3",
        },
      },
    ],
  },
  { parent: ns }
);
