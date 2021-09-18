Imports Pulumi

Module Program

    Sub Main()
        Deployment.RunAsync(Of S3Website)().Wait()
    End Sub

End Module
