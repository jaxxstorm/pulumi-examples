output "vnet_id" {
  value = azurerm_virtual_network.vnet.id
}

output "vnet_subnet" {
    value = azurerm_subnet.vnet.id
}