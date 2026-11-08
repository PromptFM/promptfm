variable "gcp_project_id" {
  description = "GCP project that holds the Secret Manager secret and the state bucket"
  type        = string
  default     = "promptfm-radio-1793623670"
}

variable "oci_credentials_secret" {
  description = "Secret Manager secret with the Oracle API credentials as JSON"
  type        = string
  default     = "promptfm-oci-credentials"
}

variable "compartment_ocid" {
  description = "Compartment for all resources. Empty uses the tenancy (root compartment)."
  type        = string
  default     = ""
}

variable "instance_name" {
  description = "Display name of the streamer VM"
  type        = string
  default     = "promptfm-streamer"
}

# Always Free limits for Ampere A1: 4 OCPU and 24 GB RAM in total across the tenancy,
# and 200 GB of block storage including boot volumes. The validations below keep a typo from
# creating something billable.
variable "ocpus" {
  description = "A1 OCPUs (Always Free allows up to 4 in total)"
  type        = number
  default     = 2

  validation {
    condition     = var.ocpus >= 1 && var.ocpus <= 4
    error_message = "Always Free A1 allows at most 4 OCPUs in total."
  }
}

variable "memory_gb" {
  description = "A1 memory in GB (Always Free allows up to 24 in total)"
  type        = number
  default     = 12

  validation {
    condition     = var.memory_gb >= 1 && var.memory_gb <= 24
    error_message = "Always Free A1 allows at most 24 GB of memory in total."
  }
}

variable "boot_volume_gb" {
  description = "Boot volume size in GB (Always Free block storage is 200 GB in total)"
  type        = number
  default     = 50

  validation {
    condition     = var.boot_volume_gb >= 50 && var.boot_volume_gb <= 200
    error_message = "Boot volume must be 50-200 GB to stay inside Always Free block storage."
  }
}

variable "ssh_pub_key_path" {
  description = "Public key installed for the ubuntu user"
  type        = string
  default     = "~/.ssh/google_compute_engine.pub"
}

variable "vcn_cidr" {
  description = "CIDR for the VCN and its single public subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "ssh_allowed_cidr" {
  description = "Source range allowed to reach SSH (22). Restrict this if you have a fixed IP."
  type        = string
  default     = "0.0.0.0/0"
}

variable "budget_alert_email" {
  description = "If set, creates a $1 monthly budget that emails this address at 100% of actual spend"
  type        = string
  default     = ""
}
