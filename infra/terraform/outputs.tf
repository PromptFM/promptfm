output "instance_name" {
  description = "The name of the stream server instance"
  value       = google_compute_instance.streamer.name
}

output "instance_id" {
  description = "The server-assigned unique identifier of the instance"
  value       = google_compute_instance.streamer.instance_id
}

output "zone" {
  description = "The GCP zone where the stream server is hosted"
  value       = google_compute_instance.streamer.zone
}

output "internal_ip" {
  description = "Internal private IPv4 address"
  value       = google_compute_instance.streamer.network_interface[0].network_ip
}

output "external_ip" {
  description = "External public IPv4 address"
  value       = google_compute_instance.streamer.network_interface[0].access_config[0].nat_ip
}

output "stream_url" {
  description = "Public audio stream URL routed through edge/HTTPS (zero GCP egress bandwidth)"
  value       = "https://stream.${var.domain_name}/stream.mp3"
}

output "internal_icecast_url" {
  description = "Internal Icecast mount URL (port 8000 accessible only via localhost/SSH tunnel to prevent public egress)"
  value       = "http://127.0.0.1:8000/stream.mp3"
}

output "icecast_admin_url" {
  description = "Icecast administration dashboard URL (accessible via SSH tunnel or localhost)"
  value       = "http://127.0.0.1:8000/admin/"
}

output "gcs_state_bucket" {
  description = "Google Cloud Storage bucket storing Terraform state (100% Free Tier)"
  value       = google_storage_bucket.tf_state.name
}

output "monitoring_dashboard_id" {
  description = "Google Cloud Monitoring 0-Cost Telemetry Dashboard ID"
  value       = google_monitoring_dashboard.telemetry_dashboard.id
}

output "monitoring_dashboard_url" {
  description = "Direct Console URL for the PromptFM 0-Cost Monitoring Dashboard"
  value       = "https://console.cloud.google.com/monitoring/dashboards/builder/${google_monitoring_dashboard.telemetry_dashboard.id}?project=${var.project_id}"
}

output "vercel_analytics_url" {
  description = "Direct Console URL for Vercel Web Analytics ($0 Tier)"
  value       = "https://vercel.com/alex-trifans-projects/promptfm/analytics"
}

# ── OAuth 2.0 & Multi-Cloud Identity Outputs ──────────────────────────────────

output "oauth_secret_manager_client_id_name" {
  description = "Google Secret Manager secret storing the Google OAuth Client ID"
  value       = google_secret_manager_secret.oauth_client_id.secret_id
}

output "oauth_secret_manager_client_secret_name" {
  description = "Google Secret Manager secret storing the Google OAuth Client Secret"
  value       = google_secret_manager_secret.oauth_client_secret.secret_id
}

output "oauth_brand_spec" {
  description = "Standardized OAuth 2.0 Consent Screen metadata and verification exemption specification"
  value       = local.oauth_brand_specification
}

output "oauth_supabase_provider_wiring" {
  description = "Declarative JSON wiring for Supabase Auth Google Provider"
  value       = local.supabase_google_provider_wiring
}

output "oauth_authorized_redirect_uris" {
  description = "List of authorized OAuth 2.0 redirect callbacks for Google Console and external cloud IDPs"
  value       = var.oauth_authorized_redirect_uris
}



