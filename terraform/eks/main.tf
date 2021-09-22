data "aws_eks_cluster" "example" {
  name = "lbriggs-eksCluster-04570ef"
}

data "aws_eks_cluster_auth" "example" {
  name = "lbriggs-eksCluster-04570ef"
}

output "cluster_id" {
  value = data.aws_eks_cluster_auth.example.id
}

output "cluster_token" {
  value = data.aws_eks_cluster_auth.example.token
  sensitive = true
}
