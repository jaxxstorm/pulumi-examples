import * as k8s from "@pulumi/kubernetes";
import * as k from "@kubernetes/client-node"
import * as pulumi from "@pulumi/pulumi"

const kc = new k.KubeConfig();
kc.loadFromFile("/Users/lbriggs/.kube/config.d/micro.yaml")
const k8sApi = kc.makeApiClient(k.CoreV1Api);

k8sApi.listNode().then((res) => {
    console.log(res.body.items[0].status)
})



