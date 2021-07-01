"""A Python Pulumi program"""

import pulumi
config = pulumi.Config()
foo = config.require_object("foo")
secret_foo = config.require_secret_object("foo")
allowed_hosts = foo.get("allowed_hosts")
secret_allowed_hosts = secret_foo.apply(need_list)
print('type of not secret',type(allowed_hosts))
pulumi.log.info(f'h1 {allowed_hosts[0]}')
pulumi.log.info(f'h2 {allowed_hosts[1]}')
secret_foo.apply(lambda host: print(host))
# pulumi.log.info(secret_allowed_hosts[2])  # this line is broken and produces error



print(result)