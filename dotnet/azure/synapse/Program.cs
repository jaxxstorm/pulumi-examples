using Pulumi;
using Pulumi.AzureNative.Resources;
using Pulumi.AzureNative.Storage;
using Pulumi.AzureNative.Synapse;
using Pulumi.AzureNative.Synapse.Inputs;
using Pulumi.AzureNative.Authorization;
using Pulumi.Random;
using System.Collections.Generic;

return await Pulumi.Deployment.RunAsync(() =>
{
    // Create an Azure Resource Group
    var resourceGroup = new ResourceGroup("synapse");

    // Create an Azure resource (Storage Account)
    var storageAccount = new StorageAccount("synapse", new StorageAccountArgs
    {
        ResourceGroupName = resourceGroup.Name,
        Sku = new Pulumi.AzureNative.Storage.Inputs.SkuArgs
        {
            Name = SkuName.Standard_RAGRS
        },
        Kind = Pulumi.AzureNative.Storage.Kind.StorageV2,
        IsHnsEnabled = true,
        EnableHttpsTrafficOnly = true,
        AccessTier = AccessTier.Hot,
    });

    var users = new BlobContainer("users", new BlobContainerArgs
    {
        ResourceGroupName = resourceGroup.Name,
        AccountName = storageAccount.Name,
        PublicAccess = PublicAccess.None,
    });

    var dataLakeStorageAccountUrl = storageAccount.Name.Apply(name => $"https://{name}.dfs.core.windows.net");

    var workspace = new Workspace("synapse", new WorkspaceArgs
    {
        ResourceGroupName = resourceGroup.Name,
        DefaultDataLakeStorage = new DataLakeStorageAccountDetailsArgs
        {
            AccountUrl = dataLakeStorageAccountUrl,
            Filesystem = "users",
        },
        Identity = new ManagedIdentityArgs
        {
            Type = Pulumi.AzureNative.Synapse.ResourceIdentityType.SystemAssigned,
        },
        SqlAdministratorLogin = "sqladminuser",
        SqlAdministratorLoginPassword = "c0rrect-horse-battery-stab!e",

    });

    var subscriptionId = resourceGroup.Id.Apply(id => id.Split('/')[2]);
    var roleDefinitionId = subscriptionId.Apply(id => $"/subscriptions/{id}/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe"); // from https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles

    var storageAccess = new RoleAssignment("storage-access", new RoleAssignmentArgs
    {
        PrincipalId = workspace.Identity.Apply(i =>
        {
            return CheckIdentity(i);
        }),
        PrincipalType = Pulumi.AzureNative.Authorization.PrincipalType.ServicePrincipal,
        Scope = storageAccount.Id,
        RoleDefinitionId = roleDefinitionId,
        RoleAssignmentName = new RandomUuid("storage-access", new RandomUuidArgs()).Result,
    });

    string CheckIdentity(Pulumi.AzureNative.Synapse.Outputs.ManagedIdentityResponse? identity)
    {
        return identity != null ? identity.PrincipalId : "";
    }
});