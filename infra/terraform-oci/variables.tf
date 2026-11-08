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

# Always Free limits for Ampere A1 (Oracle docs, 2026): 1,500 OCPU-hours and 9,000 GB-hours a month,
# which is 2 OCPU and 12 GB running all month, plus 200 GB of block storage including boot volumes.
# The validations below keep a typo from creating something billable.
variable "ocpus" {
  description = "A1 OCPUs (Always Free covers 2 running all month)"
  type        = number
  default     = 2

  validation {
    condition     = var.ocpus >= 1 && var.ocpus <= 2
    error_message = "Always Free A1 covers 2 OCPUs running all month (1,500 OCPU-hours)."
  }
}

variable "memory_gb" {
  description = "A1 memory in GB (Always Free covers 12 running all month)"
  type        = number
  default     = 12

  validation {
    condition     = var.memory_gb >= 1 && var.memory_gb <= 12
    error_message = "Always Free A1 covers 12 GB running all month (9,000 GB-hours)."
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
  description = "Overrides the budget_alert_email key of the credentials secret"
  type        = string
  default     = ""
}

variable "egress_alarm_gb_per_day" {
  description = "Alarm when outbound traffic in one day passes this many GB. 10 TB/month is free, so 300 GB/day is about 9.3 TB/month."
  type        = number
  default     = 300
}

variable "enforce_quotas" {
  description = "Create a tenancy quota policy that blocks everything except the Always Free Arm allowance and 200 GB storage"
  type        = bool
  default     = true
}

variable "availability_domain_index" {
  description = "Which availability domain to launch in (0, 1, 2). Free Arm capacity runs out per domain, so try the others on 'Out of host capacity'."
  type        = number
  default     = 0

  validation {
    condition     = var.availability_domain_index >= 0 && var.availability_domain_index <= 2
    error_message = "Ashburn has up to 3 availability domains (0-2)."
  }
}
