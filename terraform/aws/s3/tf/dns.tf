data "aws_route53_zone" "briggs" {
  name = "aws.briggs.work."
}

resource "aws_route53_record" "root_domain" {
  zone_id = data.aws_route53_zone.briggs.zone_id
  name    = "www.${data.aws_route53_zone.briggs.name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cloudfront.domain_name
    zone_id                = aws_cloudfront_distribution.cloudfront.hosted_zone_id
    evaluate_target_health = false
  }
}
