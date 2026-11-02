# PromptFM Infrastructure & Automation Manual

This directory contains the complete **Infrastructure-as-Code (Terraform)**, **Configuration Management (Ansible)**, and **Deployment State Machine** for PromptFM's 24/7 continuous radio broadcast server on Google Cloud Platform.

Designed to operate strictly within the **GCP Always Free Tier ($0.00 / Month)** with zero recurring costs.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Local Tool Installation](#2-prerequisites--local-tool-installation)
3. [Authentication & Environment Configuration](#3-authentication--environment-configuration)
4. [Configuring Variables](#4-configuring-variables)
5. [The Free State Machine (GCS Remote State)](#5-the-free-state-machine-gcs-remote-state)
6. [One-Click Quickstart (`make deploy`)](#6-one-click-quickstart-make-deploy)
7. [Operational Command Reference](#7-operational-command-reference)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. Architecture Overview

```
                      [Listener / Web Player / App]
                                    │
                                    ▼
                      ┌───────────────────────────┐
                      │    Cloudflare Edge CDN    │
                      │   (stream.promptfm.com)   │
                      │  $0 Egress Bandwidth Free │
                      └─────────────┬─────────────┘
                                    │ Cloudflare Tunnel
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│              Google Cloud Compute Engine (Always-Free)            │
│                 us-central1-a  •  e2-micro (1 GB RAM)             │
│                                                                   │
│  ┌───────────────────────┐            ┌────────────────────────┐  │
│  │   promptfm-icecast    │ ◄───────── │   promptfm-liquidsoap  │  │
│  │   (Icecast 2.4.4)     │  128 kbps  │    (Liquidsoap 2.2)    │  │
│  │   Port 8000: /stream  │   stream   │   Dynamic DJ Crossfade │  │
│  └───────────────────────┘            └───────────▲────────────┘  │
│                                                   │ Queries API   │
│                                                   ▼ & R2 MP3s     │
│                                       ┌────────────────────────┐  │
│                                       │ PromptFM Next.js & R2  │  │
│                                       │   /api/radio/next      │  │
│                                       └────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites & Local Tool Installation

To manage and deploy the infrastructure from your Mac, Linux, or Windows (WSL) terminal, install the following standard CLI tools:

### macOS (via Homebrew)
```bash
brew install terraform ansible google-cloud-sdk make curl
```

### Ubuntu / Debian Linux
```bash
# Terraform
sudo apt-get update && sudo apt-get install -y gnupg software-properties-common curl make
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update && sudo apt-get install -y terraform ansible

# Google Cloud SDK
sudo apt-get install -y google-cloud-cli
```

---

## 3. Authentication & Environment Configuration

### Step 1: Sign in to Google Cloud
```bash
gcloud auth login
gcloud auth application-default login
```

### Step 2: Set your Active GCP Project
```bash
gcloud config set project promptfm-radio-1793623670
```

### Step 3: Configure SSH Key
Google Cloud Compute Engine uses your SSH key to allow Ansible and `gcloud` to configure the instance:
```bash
# If you don't already have a key, generate one:
ssh-keygen -t rsa -b 3072 -f ~/.ssh/google_compute_engine -N ""
```

---

## 4. Configuring Variables

### A. Terraform Variables (`infra/terraform/`)
Create a `terraform.tfvars` file from the example template:
```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Edit [`infra/terraform/terraform.tfvars`](terraform/terraform.tfvars) to customize your deployment:
```hcl
project_id        = "promptfm-radio-1793623670"
region            = "us-central1"               # Strictly us-central1, us-east1, or us-west1
zone              = "us-central1-a"
instance_name     = "promptfm-streamer"
machine_type      = "e2-micro"                  # Strictly e2-micro for Always Free ($0)
disk_type         = "pd-standard"               # Strictly pd-standard (NOT pd-balanced or ssd)
disk_size_gb      = 30                          # Max 30 GB standard disk for Always Free
ssh_user          = "ubuntu"
ssh_pub_key_path  = "~/.ssh/google_compute_engine.pub"
```

> [!WARNING]
> Do **NOT** change `machine_type` to `e2-small` or `disk_type` to `pd-balanced`/`pd-ssd`. Those types are **not** eligible for GCP's Always Free tier and will generate hourly charges.

---

### B. Ansible Variables (`infra/ansible/`)
The inventory file is located at [`infra/ansible/inventory.ini`](ansible/inventory.ini).
Variables can be overridden directly in `inventory.ini` or via environment variables:

```ini
[streamer]
promptfm-streamer ansible_host=34.123.80.137 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/google_compute_engine

[streamer:vars]
app_dir=/opt/promptfm/streamer
promptfm_api_url=https://promptfm.live
stream_bitrate=128
icecast_port=8000
icecast_source_password=promptfm_source_2026
icecast_admin_password=promptfm_admin_2026
```

#### Optional: Zero-Egress Cloudflare Tunnel Token
If connecting the stream to Cloudflare CDN to eliminate GCP bandwidth costs:
```bash
export CLOUDFLARE_TUNNEL_TOKEN="your-tunnel-token-here"
```

---

## 5. The Free State Machine (GCS Remote State)

Terraform state is stored remotely in **Google Cloud Storage (GCS)** in `us-central1`:
* **Why it's $0.00**: GCP includes **5 GB of Standard GCS storage** per month for free in US regions. A Terraform state file is ~50 KB (less than 0.001% of the free quota).
* **Automatic State Locking**: Prevents concurrent deployments from corrupting infrastructure state.

### Initialize the GCS State Bucket (One-Time)
Run this command once before the first `terraform init`:
```bash
gcloud storage buckets create gs://promptfm-tfstate-promptfm-radio-1793623670 \
    --project="promptfm-radio-1793623670" \
    --location="us-central1"
```

*(To use local state instead, comment out the `backend "gcs"` block in [`infra/terraform/versions.tf`](terraform/versions.tf)).*

---

## 6. One-Click Quickstart (`make deploy`)

The fastest way to deploy the entire stack from scratch:

```bash
cd infra
make deploy
```

### What `make deploy` executes automatically:
1. **Initializes & Runs Terraform**: Provisions the `e2-micro` VM, 30 GB standard disk, and port 8000 firewall rule.
2. **Dynamic Inventory Sync**: Resolves the VM's external IP address and updates Ansible's `inventory.ini`.
3. **Waits for SSH**: Polls port 22 until the instance is reachable.
4. **Runs Ansible Playbook**: Installs Docker & Docker Compose, copies Icecast & Liquidsoap configs, downloads fallback audio, and starts containers.
5. **Performs Health Check**: Confirms `http://<IP>:8000/status.xsl` responds with HTTP 200/400.

---

## 7. Operational Command Reference

All daily operations can be run with standard `make` targets from the `infra/` folder:

| Command | Action | Description |
| :--- | :--- | :--- |
| `make help` | Display Guide | Prints all available commands and descriptions. |
| `make deploy` | **Full Pipeline** | Runs Terraform $\rightarrow$ Updates IP $\rightarrow$ Executes Ansible $\rightarrow$ Healthcheck. |
| `make plan` | Terraform Preview | Runs `terraform plan` to view planned infrastructure changes without applying. |
| `make apply` | Terraform Apply | Applies infrastructure changes directly via Terraform. |
| `make ansible` | Configuration Only | Re-runs the Ansible playbook against the live VM without touching cloud resources. |
| `make status` | Health Inspection | Displays live container status and curls Icecast status on the VM. |
| `make logs` | Tail Live Logs | Follows real-time logs from Icecast and Liquidsoap to see which songs/DJ drops air. |
| `make destroy` | Cloud Teardown | Tears down the GCP VM and firewall rules when no longer needed. |

---

## 8. Troubleshooting & FAQs

### Q: Why does `apt-get` or the VM feel slow during the initial boot?
**A:** `e2-micro` instances utilize shared-core burstable CPUs with 1 GB of RAM and standard spinning HDDs (`pd-standard`) to remain strictly within Google's $0 Always Free tier. Package installations during first boot take ~3–4 minutes. Once Docker and the containers are pulled, day-to-day audio streaming requires less than 8% CPU.

### Q: Why is port 8000 returning `Connection reset` or timing out?
1. Ensure the firewall rule exists:
   ```bash
   gcloud compute firewall-rules list --filter="name=allow-icecast"
   ```
2. Check that the Icecast container is running:
   ```bash
   make status
   ```
3. Test locally on the VM:
   ```bash
   gcloud compute ssh promptfm-streamer --command="curl -I http://localhost:8000/status.xsl"
   ```

### Q: How do I change the music stream bitrate?
Edit `stream_bitrate` in [`infra/ansible/inventory.ini`](ansible/inventory.ini) (default is `128` kbps for high-quality MP3) and re-run `make ansible`.

### Q: How do I avoid all GCP egress charges?
Configure a Cloudflare Tunnel (`cloudflared`). The tunnel proxies port 8000 out to `stream.promptfm.com` via Cloudflare's global edge network, absorbing 100% of listener traffic with **unlimited free egress bandwidth**.

