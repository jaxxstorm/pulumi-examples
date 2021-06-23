"""A Python Pulumi program"""

import pulumi

config = pulumi.Config()
foo = config.require_object("foo")
secret_foo = config.require_secret_object("foo")

allowed_hosts = foo.get("allowed_hosts")
secret_allowed_hosts = secret_foo.apply(lambda h: print(h.get("allowed_hosts")))

print(type(allowed_hosts))
pulumi.log.info(allowed_hosts[0])
pulumi.log.info(allowed_hosts[1])

pulumi.log.info(secret_allowed_hosts[2])

secret_foo.apply(lambda host: print(host))