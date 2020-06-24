import pulumi
import pulumi_random

# Create a new randomly generated password
password = pulumi_random.RandomPassword("super-secret-password", length=20, special=True,
                                        opts=pulumi.ResourceOptions(additional_secret_outputs=['result']))

# Export the password as "secret"
pulumi.export("secret", password.result)


