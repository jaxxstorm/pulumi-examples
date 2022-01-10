import * as k8s from "@pulumi/kubernetes";
import * as i13t from "./istioDeployment";
import * as canary from "./ingressCanary";
import { v1 } from "@pulumi/kubernetes/types/enums/core";

const ns = new k8s.core.v1.Namespace("bookinfo", {
  metadata: {
    name: "bookinfo",
    labels: {
      "istio-injection": "enabled",
    },
  },
});

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

details.createService("details", { port: 9080, namespace: ns.metadata.name });

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

ratings.createService("ratings", { port: 9080, namespace: ns.metadata.name });

const reviews = new i13t.IstioDeployment(
  "reviewsv1",
  {
    image: "docker.io/istio/examples-bookinfo-reviews-v1:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    extraEnv: [{ name: "reviews-version", value: "v1" }],
  },
  { parent: ns }
);

reviews.createService("reviews", { port: 9080, namespace: ns.metadata.name });

const reviewsV2 = new i13t.IstioDeployment(
  "reviewsv2",
  {
    image: "docker.io/istio/examples-bookinfo-reviews-v2:1.16.2",
    port: 9080,
    namespace: ns.metadata.name,
    version: "v2",
    extraEnv: [{ name: "reviews-version", value: "v2" }],
    appLabel: "reviews",
  },
  { parent: ns }
);

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

const productsvc = productPage.createService("productpage", {
  port: 9080,
  namespace: ns.metadata.name,
});

new canary.IngressCanary("bookinfo", {
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
            subset: "v1",
            port: {
              number: 9080,
            },
          },
          weight: 90,
        },
        {
          destination: {
            host: productsvc.metadata.name,
            subset: "v2",
            port: {
              number: 9080,
            },
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
      name: "v2",
      labels: {
        version: "v2",
      },
    },
  ],
});
