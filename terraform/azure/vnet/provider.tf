terraform {
  required_version = "=1.3.7"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">=3.11.0, <4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.3.2"
    }
  }
  cloud {
    organization = "lbrlabs"

    workspaces {
      name = "network"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

provider "random" {}
