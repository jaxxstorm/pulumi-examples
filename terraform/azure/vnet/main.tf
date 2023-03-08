resource "azurerm_resource_group" "vnet" {
  name     = "vnet"
  location = "WestUS2"
}

resource "azurerm_virtual_network" "vnet" {
  address_space       = ["10.52.0.0/16"]
  location            = azurerm_resource_group.vnet.location
  name                = "vnet"
  resource_group_name = azurerm_resource_group.vnet.name
}

resource "azurerm_subnet" "vnet" {
  address_prefixes                               = ["10.52.0.0/24"]
  name                                           = "subnet"
  resource_group_name                            = azurerm_resource_group.vnet.name
  virtual_network_name                           = azurerm_virtual_network.vnet.name
}