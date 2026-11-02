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
