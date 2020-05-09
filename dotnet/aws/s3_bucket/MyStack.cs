using Pulumi;
using Pulumi.Aws.S3;

class AnotherStack : Stack
{
    public AnotherStack()
    {
        var config = new Config();
        this.SuperSecret = config.RequireSecret("supersecret");

        var bucket = new Bucket("bucket", new BucketArgs {
            Acl = "private",
        });

        var bucketObject = new BucketObject("secret", new BucketObjectArgs {
            Bucket = bucket.Id,
            Key = "secret",
            Content = SuperSecret

        });
    }
    [Output("superSecret")] public Output<string> SuperSecret { get; set; }
}
