output "cloudfront_url" {
    value = aws_cloudfront_distribution.cloudfront.domain_name
}

output "s3_url" {
  value = "${aws_s3_bucket_website_configuration.wc.website_endpoint}"
}
