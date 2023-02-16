import requests
import os
import tabulate
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("org", help="The Pulumi org name to query for stacks")
parser.add_argument("--lastupdate", help="sort by last update instead of resource count", action="store_true")
args = parser.parse_args()

url = f"https://api.pulumi.com/api/user/stacks?organization={args.org}"

headers = {
    'Accept': 'application/vnd.pulumi+8',
    'Content-Type': 'application/json',
    'Authorization': 'token ' + os.getenv('PULUMI_ACCESS_TOKEN', ''),
}

response = requests.get(url, headers=headers)

data = response.json()
stacks = data['stacks']

continuationToken = data.get('continuationToken')

while continuationToken is not None:
    response = requests.get(url + '&continuationToken=' + continuationToken, headers=headers)
    continue_data = response.json()
    continuationToken = continue_data.get('continuationToken')
    stacks += continue_data['stacks']

stacks_with_resources = [stack
           for stack in stacks
           if 'resourceCount' in stack]

if args.lastupdate:
    sorted_stacks = sorted(stacks_with_resources, key=lambda x: x['lastUpdate'], reverse=True)
else:
    sorted_stacks = sorted(stacks_with_resources, key=lambda x: x['resourceCount'], reverse=True)
    
print(tabulate.tabulate(sorted_stacks, headers='keys'))