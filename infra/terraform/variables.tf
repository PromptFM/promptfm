variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "promptfm-radio-1793623670"
}

variable "region" {
  description = "GCP Region for Always-Free Tier (must be us-central1, us-east1, or us-west1)"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone for the stream server VM"
  type        = string
  default     = "us-central1-a"
}

variable "instance_name" {
  description = "Name of the Compute Engine VM"
  type        = string
  default     = "promptfm-streamer"
}

variable "machine_type" {
  description = "Machine type for Always-Free Tier (strictly e2-micro)"
  type        = string
  default     = "e2-micro"
}

variable "disk_size_gb" {
  description = "Disk size in GB (up to 30 GB standard disk is Always Free)"
  type        = number
  default     = 30
}

variable "disk_type" {
  description = "Disk type (must be pd-standard for Always Free; do NOT use pd-balanced or pd-ssd)"
  type        = string
  default     = "pd-standard"
}

variable "ssh_user" {
  description = "SSH username for remote provisioning"
  type        = string
  default     = "ubuntu"
}

variable "ssh_pub_key_path" {
  description = "Path to public SSH key for VM access"
  type        = string
  default     = "~/.ssh/google_compute_engine.pub"
}

# ── OAuth 2.0 Client & Multi-Cloud Identity Wiring ────────────────────────────

variable "oauth_app_name" {
  description = "Brand display name for the OAuth Consent Screen"
  type        = string
  default     = "PromptFM"
}

variable "oauth_support_email" {
  description = "Support contact email for OAuth Consent Screen"
  type        = string
  default     = "trifan.alex.criss@gmail.com"
}

variable "oauth_authorized_javascript_origins" {
  description = "Authorized JavaScript origins for OAuth 2.0 Web Client"
  type        = list(string)
  default = [
    "https://promptfm.live",
    "https://oxfacfdpxbxilucooijy.supabase.co",
    "http://localhost:3000"
  ]
}

variable "oauth_authorized_redirect_uris" {
  description = "Authorized redirect URIs for OAuth 2.0 Web Client (Supabase, local dev, production)"
  type        = list(string)
  default = [
    "https://oxfacfdpxbxilucooijy.supabase.co/auth/v1/callback",
    "https://promptfm.live",
    "http://localhost:3000"
  ]
}

variable "oauth_scopes" {
  description = "Non-sensitive OAuth scopes enabling instant 0-cost General Availability without Google App Verification"
  type        = list(string)
  default = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}

# ── Domain & DNS Automation (Hostinger & Zero-Egress Edge) ────────────────────

variable "domain_name" {
  description = "Primary production domain name for PromptFM (managed via Hostinger DNS)"
  type        = string
  default     = "promptfm.live"
}

variable "stream_subdomain" {
  description = "Subdomain prefix for audio streaming"
  type        = string
  default     = "stream"
}

variable "cloudflare_tunnel_enabled" {
  description = "Whether to route audio traffic through Cloudflare Tunnel for $0 GCP egress"
  type        = bool
  default     = true
}

variable "hostinger_api_token" {
  description = "Hostinger API token for automated DNS zone synchronization and domain migration"
  type        = string
  default     = ""
  sensitive   = true
}

# ── GitHub Repository & Community Project IaC ─────────────────────────────────

variable "github_token" {
  description = "GitHub Personal Access Token for managing repository, labels, and milestones"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub Organization or Owner login"
  type        = string
  default     = "PromptFM"
}

variable "github_repository" {
  description = "GitHub Repository Name"
  type        = string
  default     = "promptfm"
}



variable "streamer_vm_running" {
  description = "Whether the GCP streamer VM is running. The stream is served from Oracle (infra/terraform-oci), so this is false and the VM stays stopped. GCP only includes 1 GB/month of outbound traffic. Set it to true only when rolling the stream back to GCP (infra/rollback-stream-to-gcp.sh)."
  type        = bool
  default     = false
}
