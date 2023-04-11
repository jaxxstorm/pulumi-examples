using Pulumi;
using Pulumi.AzureNative.Resources;
using Pulumi.AzureNative.Storage;
using Pulumi.AzureNative.Storage.Inputs;
using System.Collections.Generic;

return await Pulumi.Deployment.RunAsync(() =>
{
    // Invoke Method
    var asyncResourceGroup = GetResourceGroup.InvokeAsync(new GetResourceGroupArgs
    {
        ResourceGroupName = "lbriggs"
    }).Result; // Note the result

    // Create an Azure resource (Storage Account)
    var asyncStorageAccount = new StorageAccount("async", new StorageAccountArgs
    {
        ResourceGroupName = asyncResourceGroup.Name,
        Sku = new SkuArgs
        {
            Name = SkuName.Standard_LRS
        },
        Kind = Kind.StorageV2
    });

    var invokeResourceGroup = GetResourceGroup.Invoke(new GetResourceGroupInvokeArgs
    {
        ResourceGroupName = "lbriggs"
    });

    var invokeStorageAccount = new StorageAccount("invoke", new StorageAccountArgs
    {
        ResourceGroupName = invokeResourceGroup.Apply(n => n.Name), // need an apply to retrieve the name
        Sku = new SkuArgs
        {
            Name = SkuName.Standard_LRS
        },
        Kind = Kind.StorageV2
    });

   

    // Export the primary key of the Storage Account
    return new Dictionary<string, object?>
    {
        ["async"] = asyncStorageAccount.Name,
        ["invoke"] = invokeStorageAccount.Name
    };
});