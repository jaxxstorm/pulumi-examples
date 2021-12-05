# Azure Platform Example

## Test AAD

```bash
export IDENTITY_NAME=$(pulumi stack output identityName)
export IDENTITY_RESOURCE_GROUP=$(pulumi stack output identityResourceGroup)
export IDENTITY_CLIENT_ID=$(pulumi stack output identityId)

cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: demo
  labels:
    aadpodidbinding: $IDENTITY_NAME
spec:
  containers:
  - name: demo
    image: mcr.microsoft.com/oss/azure/aad-pod-identity/demo:v1.8.4
    args:
      - --subscription-id=${SUBSCRIPTION_ID}
      - --resource-group=${IDENTITY_RESOURCE_GROUP}
      - --identity-client-id=${IDENTITY_CLIENT_ID}
  nodeSelector:
    kubernetes.io/os: linux
EOF
```

