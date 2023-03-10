import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// let's create some buckets from an array
const bucketNames = ["bucket1", "bucket2", "bucket3"];

// we ca also create a more complex object
interface bucketsWithNames {
    name: string;
    bucket: aws.s3.Bucket;
}

// some empty arrays to store the buckets
const buckets: aws.s3.Bucket[] = [];
const bucketsWithNames: bucketsWithNames[] = [];

// loop through the array and create the buckets
bucketNames.forEach((bucket) => {
  const theBucket = new aws.s3.Bucket(bucket, {});
  const bucketWithName: bucketsWithNames = {name: bucket, bucket: theBucket};
  buckets.push(theBucket);
  bucketsWithNames.push(bucketWithName);
    
});

export const arrayOfBuckets = buckets;
export const arrayOfBucketsWithIndex = bucketsWithNames

// we can now access a bucket by array index, if we want
new aws.s3.BucketObject("created-by-array", {
    bucket: buckets[0],
})

// or we can track it down by the index if we create it that way
new aws.s3.BucketObject("created-by-index", {
    bucket: arrayOfBucketsWithIndex.find((bucket) => bucket.name === "bucket2")!.bucket,
})
