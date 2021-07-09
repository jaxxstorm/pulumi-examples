#!/bin/bash

# Build some variables for later
STACK_NAME=$(aws ec2 describe-instances --instance-id $(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq .instanceId -r) --region eu-west-1 --query "Reservations[*].Instances[*].Tags[?Key=='aws:cloudformation:stack-name'].Value" --output text)
REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq .region -r)
ASG_NAME=$(aws ec2 describe-instances --instance-id $(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq .instanceId -r) --region eu-west-1 --query "Reservations[*].Instances[*].Tags[?Key=='aws:autoscaling:groupName'].Value" --output text)

# This installs the web server software
yum install -y nginx
chkconfig nginx on
service nginx start

# Check if nginx comes up
printf "Waiting for nginx to be ready"
until $(curl -k --output /dev/null --silent --head --fail --max-time 2 ${HEALTHCHECK_URI}); do
    printf '.'
    sleep 2
done
echo
echo "nginx is ready!"
echo "sending cfn-signal"
# sends a signal to cloudformation informing it that the instance is healthy
/opt/aws/bin/cfn-signal --resource ${ASG_NAME} --stack ${STACK_NAME} --region ${REGION}