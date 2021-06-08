import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const bucket = new gcp.storage.Bucket("website", {
  location: "US",
  website: {
      mainPageSuffix: "index.html",
      notFoundPage: "404.html",
  }
});

const accessControl = new gcp.storage.DefaultObjectAccessControl("website", {
  bucket: bucket.name,
  role: "READER",
  entity: "allUsers",
});

["index.html", "404.html"].map(
  (name) =>
    new gcp.storage.BucketObject(name, {
      bucket: bucket.name,
      name: name,
      source: new pulumi.asset.FileAsset(`./wwwroot/${name}`),
      
    }, { dependsOn: accessControl })
);

export const url = pulumi.interpolate`http://storage.googleapis.com/${bucket.name}/index.html`
