terraform {
  required_version = ">= 1.5.0"

  required_providers {
    resend = {
      source  = "armaaar/resend"
      version = "~> 1.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 8.9"
    }
  }

  # Same free GCS bucket as the other modules, its own prefix.
  backend "gcs" {
    bucket = "promptfm-tfstate-promptfm-radio-1793623670"
    prefix = "terraform/resend-state"
  }
}

provider "google" {
  project = var.gcp_project_id
}

# The Resend API key lives in Secret Manager (promptfm-resend-api-key). Locally and in CI it is read the same way.
data "google_secret_manager_secret_version" "resend_api_key" {
  secret = var.resend_api_key_secret
}

provider "resend" {
  api_key = trimspace(data.google_secret_manager_secret_version.resend_api_key.secret_data)
}
