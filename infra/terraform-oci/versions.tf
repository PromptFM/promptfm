terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 8.9"
    }
  }

  # State lives in the existing free GCS bucket under its own prefix, separate from the GCP module.
  backend "gcs" {
    bucket = "promptfm-tfstate-promptfm-radio-1793623670"
    prefix = "terraform/oci-state"
  }
}

provider "google" {
  project = var.gcp_project_id
}

# One JSON secret keeps this at a single Secret Manager version (6 are free).
# Keys: user_ocid, tenancy_ocid, fingerprint, region, private_key (Oracle API key),
# ssh_public_key and ssh_private_key (deploy key for the VM), budget_alert_email (optional).
data "google_secret_manager_secret_version" "oci" {
  secret = var.oci_credentials_secret
}

locals {
  oci = jsondecode(data.google_secret_manager_secret_version.oci.secret_data)

  compartment_id = var.compartment_ocid != "" ? var.compartment_ocid : nonsensitive(local.oci.tenancy_ocid)
  budget_email   = var.budget_alert_email != "" ? var.budget_alert_email : try(nonsensitive(local.oci.budget_alert_email), "")
}

provider "oci" {
  tenancy_ocid = nonsensitive(local.oci.tenancy_ocid)
  user_ocid    = nonsensitive(local.oci.user_ocid)
  fingerprint  = nonsensitive(local.oci.fingerprint)
  region       = nonsensitive(local.oci.region)
  private_key  = local.oci.private_key
}
