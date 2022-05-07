#!/bin/bash
terraform init > /dev/null
terraform apply -auto-approve > /dev/null 
terraform output test | sed '1d;$d'