import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// const bucket = new aws.s3.Bucket("my-bucket")
const bucket = new aws.s3.Bucket("my-bucket");

const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
  bucket: bucket.id, // refer to the bucket created earlier
  policy: bucket.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [
            `${arn}/*`, //
          ],
        },
      ],
    })
  ),
});

/*
 * Create a mechanism to store the object Ids
 * It's of type `Output<string>
 */
export let objectIds: pulumi.Output<string>[] = [];

const iWantToUploadObject = false;

if (iWantToUploadObject) {
  /*
   *  Loop through the files and push the object id into the array
   */
  const objects = ["index.html", "404.html"].map((name) => {
    let obj = new aws.s3.BucketObject(name, {
      bucket: bucket.id,
      source: new pulumi.asset.FileAsset(`./wwwroot/${name}`),
      contentType: "text/html",
    });
    objectIds.push(obj.id);
  });
}
