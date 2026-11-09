output "addresses" {
  description = "Addresses registered in config/inbound-forwarding.json (Resend receives all of them through one MX record)"
  value       = local.addresses
}

output "webhook_id" {
  value = resend_webhook.inbound.id
}

output "webhook_endpoint" {
  value = resend_webhook.inbound.endpoint
}
