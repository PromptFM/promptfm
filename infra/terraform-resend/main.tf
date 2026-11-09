# infra/terraform-resend/main.tf
# Inbound mail for promptfm.live. Resend receives every address on the domain (one MX record) and POSTs it to the
# app webhook, which forwards it. Which addresses are known, their category and where they forward is declared in
# config/inbound-forwarding.json, the same file the app reads. To add an address, add it there and apply.

locals {
  forwarding = jsondecode(file("${path.module}/../../config/inbound-forwarding.json"))
  domain     = local.forwarding.domain
  aliases    = keys(local.forwarding.aliases)
  addresses  = [for a in local.aliases : "${a}@${local.domain}"]
}

data "resend_domains" "all" {}

locals {
  domain_id = one([for d in data.resend_domains.all.domains : d.id if d.name == local.domain])
}

data "resend_domain" "inbound" {
  id = local.domain_id

  lifecycle {
    postcondition {
      condition     = self.capabilities.receiving == "enabled"
      error_message = "Receiving is not enabled for ${local.domain} in Resend, so no address would arrive. Enable it on the domain page and add the MX record."
    }
  }
}

# The webhook that already exists in the Resend account is adopted, not duplicated.
import {
  to = resend_webhook.inbound
  id = "397a61ec-75c5-42c7-92c8-151f31d021eb"
}

resource "resend_webhook" "inbound" {
  endpoint = var.webhook_endpoint
  events   = ["email.received"]
  status   = "enabled"
}

# Keeps RESEND_WEBHOOK_SECRET in Secret Manager equal to the webhook's real signing secret.
import {
  to = google_secret_manager_secret.webhook
  id = "projects/${var.gcp_project_id}/secrets/${var.webhook_secret_name}"
}

resource "google_secret_manager_secret" "webhook" {
  secret_id = var.webhook_secret_name

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "webhook" {
  secret      = google_secret_manager_secret.webhook.id
  secret_data = resend_webhook.inbound.signing_secret
}
