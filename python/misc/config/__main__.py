"""A Python Pulumi program"""

import pulumi
import json

config = pulumi.Config()
foo = config.require_object("foo")
secret_foo = config.require_secret_object("foo")
allowed_hosts = foo.get("allowed_hosts")
pulumi.log.info(f'h1 {allowed_hosts[0]}')
pulumi.log.info(f'h2 {allowed_hosts[1]}')
secret_foo.apply(lambda host: print(host))

cfg = pulumi.Config("access")
users = cfg.get_object("users")
users = json.loads(cfg.get("users"))

print(users)