# infra/terraform/dns.tf
# Declarative DNS zone state and domain migration metadata for Hostinger & Cloudflare.

locals {
  dns_state_file = "${path.module}/../dns/${var.domain_name}.state.json"
  dns_state      = fileexists(local.dns_state_file) ? jsondecode(file(local.dns_state_file)) : null
}

output "primary_domain" {
  description = "Configured primary domain name"
  value       = var.domain_name
}

output "dns_state_tracked" {
  description = "Whether a declarative DNS state snapshot is tracked for the active domain"
  value       = local.dns_state != null
}

output "dns_record_count" {
  description = "Total number of DNS records tracked in local state"
  value       = local.dns_state != null ? length(local.dns_state.zone) : 0
}
