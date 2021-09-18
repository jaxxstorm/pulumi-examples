Imports Pulumi
Imports Pulumi.Aws.S3
Imports Pulumi.Aws.S3.Inputs


Class S3Website
    Inherits Stack

    Public Sub New()

        ' Define a bucket to host our website
        Dim websiteArgs = New BucketWebsiteArgs With { .IndexDocument = "index.html", .ErrorDocument = "error.html" }
        Dim bucket = new Aws.S3.Bucket("static-website",
                                       New BucketArgs With  { .Acl = "public-read", .Website = websiteArgs  })

        ' Loop through the contents of the www directory
        Dim files() As String = {"index.html", "error.html"}

        ' thanks stackoverflow
        For i = 0 To ubound(files)
            Dim bucketObject = New Aws.S3.BucketObject(files(i), New BucketObjectArgs _
                                                          With { .Acl = "public-read", .Bucket = bucket.Id,
                                                          .Source = New Pulumi.FileAsset(files(i)) },
                                                       New CustomResourceOptions With { .Parent = bucket })
        Next
        
        Address = bucket.WebsiteEndpoint
        
    End Sub
    
    <Output>
    Public Property Address As Output(Of String)
    
End Class
