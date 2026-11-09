variable "gcp_project_id" {
  description = "GCP project that holds the secrets and the state bucket"
  type        = string
  default     = "promptfm-radio-1793623670"
}

variable "resend_api_key_secret" {
  description = "Secret Manager secret holding the Resend API key (full access)"
  type        = string
  default     = "promptfm-resend-api-key"
}

variable "webhook_secret_name" {
  description = "Secret Manager secret that receives the webhook signing secret (RESEND_WEBHOOK_SECRET)"
  type        = string
  default     = "promptfm-resend-webhook-secret"
}

variable "webhook_endpoint" {
  description = "Where Resend POSTs received mail"
  type        = string
  default     = "https://promptfm.live/api/webhooks/resend"
}
