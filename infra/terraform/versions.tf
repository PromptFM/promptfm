terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.9"
    }
  }

  # Free State Backend: Google Cloud Storage (GCS)
  # Uses standard storage in us-central1 (100% covered by GCP's 5GB Always-Free storage).
  # Run `gcloud storage buckets create gs://promptfm-tfstate-<project-id> --location=us-central1`
  # to initialize, or comment this block out to store state locally.
  backend "gcs" {
    bucket = "promptfm-tfstate-promptfm-radio-1793623670"
    prefix = "terraform/state"
  }
}

