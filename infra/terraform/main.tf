# infra/terraform/main.tf
# Provisions the PromptFM 24/7 Stream Server strictly within the GCP Always-Free Tier limits ($0.00/month).

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# 1. State Storage Bucket (100% Free: GCP includes 5 GB of standard GCS storage in us-central1)
resource "google_storage_bucket" "tf_state" {
  name                     = "promptfm-tfstate-${var.project_id}"
  location                 = var.region
  storage_class            = "STANDARD"
  force_destroy            = false
  public_access_prevention = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    environment = "production"
    managed_by  = "terraform"
    project     = "promptfm"
  }
}

# 2. Firewall Rule: public HTTP & HTTPS on the GCP VM, only while the GCP VM is meant to serve the stream.
# GCP includes 1 GB/month of outbound traffic and one 128 kbps listener is about 41 GB/month, so by default
# (streamer_vm_running = false, the stream is on Oracle) there is no public ingress at all. infra/converge-stream.sh
# turns the VM and this rule on together for a switch back to GCP.
resource "google_compute_firewall" "allow_web" {
  count       = var.streamer_vm_running ? 1 : 0
  name        = "allow-http-https"
  network     = "default"
  description = "Allows incoming HTTP/HTTPS traffic for the Caddy stream proxy on ports 80 and 443 (only while the GCP VM serves the stream)"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server", "promptfm-streamer"]
}

# 3. Always-Free Compute Engine VM (e2-micro, 30GB pd-standard disk)
resource "google_compute_instance" "streamer" {
  name                      = var.instance_name
  machine_type              = var.machine_type
  zone                      = var.zone
  allow_stopping_for_update = true
  desired_status            = var.streamer_vm_running ? "RUNNING" : "TERMINATED"

  lifecycle {
    ignore_changes = [service_account]
  }

  tags = ["http-server", "https-server", "promptfm-streamer"]

  boot_disk {
    auto_delete = true
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      type  = var.disk_type # pd-standard is Always-Free; do NOT change to pd-balanced/ssd
      size  = var.disk_size_gb
    }
  }

  network_interface {
    network = "default"

    # Ephemeral external IPv4 (Free; do NOT allocate static IP as GCP bills for static IPs)
    access_config {
      // Ephemeral IP assigned automatically
    }
  }

  metadata = {
    enable-oslogin = "FALSE"
    ssh-keys       = fileexists(pathexpand(var.ssh_pub_key_path)) ? "${var.ssh_user}:${file(pathexpand(var.ssh_pub_key_path))}" : ""
    startup-script = <<-EOT
      #!/bin/bash
      apt-get update
      apt-get install -y docker.io docker-compose curl
      systemctl enable --now docker
    EOT
  }

  labels = {
    app         = "promptfm"
    component   = "audio-streamer"
    environment = "production"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false # Always Free tier requires a non-preemptible e2-micro VM
  }
}

# 4. Zero-Cost Cloud Monitoring Dashboard (Gemini API quotas, synthesis latency, storage)
# Provisions the PromptFM 24/7 AI Radio telemetry dashboard at $0 cost (150 MiB metric limit free monthly).
resource "google_monitoring_dashboard" "telemetry_dashboard" {
  dashboard_json = file("${path.module}/../../config/gcp-dashboard.json")
}


