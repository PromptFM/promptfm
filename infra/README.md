# PromptFM Infrastructure & Automation Manual

This directory contains the complete **Infrastructure-as-Code (Terraform)**, **Configuration Management (Ansible)**, and **Deployment State Machine** for PromptFM's 24/7 continuous radio broadcast server on Google Cloud Platform.

Designed to operate strictly within the **GCP Always Free Tier ($0.00 / Month)** with zero recurring costs.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Caddy Automatic HTTPS & CORS Reverse Proxy](#2-caddy-automatic-https--cors-reverse-proxy)
3. [DNS & Custom Domain Setup (`stream.promptfm.live`)](#3-dns--custom-domain-setup-streampromptfmlive)
4. [Prerequisites & Local Tool Installation](#4-prerequisites--local-tool-installation)
5. [Authentication & Environment Configuration](#5-authentication--environment-configuration)
6. [Configuring Variables](#6-configuring-variables)
7. [The Free State Machine (GCS Remote State)](#7-the-free-state-machine-gcs-remote-state)
8. [One-Click Quickstart (`make deploy`)](#8-one-click-quickstart-make-deploy)
9. [Operational Command Reference](#9-operational-command-reference)
10. [Troubleshooting & FAQs](#10-troubleshooting--faqs)

---

## 1. Architecture Overview

PromptFM delivers 24/7 AI-generated music and AI DJ broadcasts with a robust, zero-cost 3-container topology:

```
                    [Web Listener / Mobile / In-Player]
                                    │
                                    │ HTTPS (Port 443)
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                stream.promptfm.live                     │
       │           (A Record ➔ GCP Streamer VM IP)                │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Google Cloud Compute Engine (Always-Free)                │
│                 us-central1-a  •  e2-micro (1 GB RAM)                  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 promptfm-caddy (Caddy 2 Alpine)                │   │
│   │   • Ports 80 & 443 (Let's Encrypt Auto-TLS / ZeroSSL)          │   │
│   │   • Permissive CORS Headers (Access-Control-Allow-Origin: *)   │   │
│   │   • Low-memory Reverse Proxy (under 18 MB RAM)                 │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Proxy to icecast:8000              │
│                                   ▼                                    │
│   ┌───────────────────────────────┐    ┌───────────────────────────┐   │
│   │       promptfm-icecast        │ ◄──│    promptfm-liquidsoap    │   │
│   │       (Icecast 2.4.4)         │    │     (Liquidsoap 2.2.5)    │   │
│   │     Port 8000: /stream.mp3    │    │   Dynamic DJ Crossfader   │   │
│   └───────────────────────────────┘    └─────────────▲─────────────┘   │
│                                                      │ Queries API     │
│                                                      ▼ & R2 MP3s       │
│                                        ┌───────────────────────────┐   │
│                                        │   PromptFM Next.js & R2   │   │
│                                        │    /api/radio/next        │   │
│                                        └───────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Caddy Automatic HTTPS & CORS Reverse Proxy

In modern browsers, web audio players on HTTPS domains (like `https://promptfm.live`) block unencrypted audio streams (`http://...:8000/stream.mp3`) due to **Mixed Content Security Restrictions**, and block cross-origin requests that lack CORS headers.

To solve this cleanly with **$0 overhead**:
1. **Caddy 2 Alpine Container**: Added to the Docker Compose topology alongside Icecast and Liquidsoap.
2. **Automatic Let's Encrypt TLS**: Caddy binds to ports 80 and 443, automatically negotiates and renews valid SSL/TLS certificates for `stream.promptfm.live`.
3. **CORS Headers**: Injected transparently into the audio stream responses:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, OPTIONS, HEAD`
   - `Access-Control-Allow-Headers: *`

### Caddyfile Configuration (`infra/ansible/roles/streamer/templates/Caddyfile.j2`)
```caddy
stream.promptfm.live {
    header Access-Control-Allow-Origin *
    header Access-Control-Allow-Methods "GET, OPTIONS, HEAD"
    header Access-Control-Allow-Headers "*"

    reverse_proxy icecast:8000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
```

### Terraform Firewall Rules (`infra/terraform/main.tf`)
Terraform opens both port 80 (ACME HTTP-01 challenge) and port 443 (HTTPS audio streaming) to `0.0.0.0/0`:
- `allow-http-https`: Ports `["80", "443"]`
- `allow-icecast-stream`: Port `["8000"]` (direct listener / internal test fallback)

---

## 3. DNS & Custom Domain Setup (`stream.promptfm.live`)

PromptFM uses two dedicated hostnames:
1. **`promptfm.live`**: Hosted on Vercel (Next.js web application, Admin Studio, community charts, and API endpoints).
2. **`stream.promptfm.live`**: A DNS `A` record pointing directly to the Google Cloud streamer VM's external IP address.

### Adding the DNS Record (Hostinger / Cloudflare)
1. In your DNS Provider management console for `promptfm.live`, add an `A` record:
   - **Type**: `A`
   - **Name / Host**: `stream` (or `stream.promptfm.live`)
   - **Points to (Value)**: `<GCP_VM_EXTERNAL_IP>` (e.g. `34.123.80.137` from `terraform output instance_external_ip`)
   - **TTL**: 300 (or Auto)
2. Once DNS propagates, Caddy automatically provisions the TLS certificate within seconds of receiving its first request!

---

## 4. Prerequisites & Local Tool Installation

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

## 5. Authentication & Environment Configuration

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

## 6. Configuring Variables

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
The inventory file is located at [`infra/ansible/inventory.ini`](ansible/inventory.ini):

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

---

## 7. The Free State Machine (GCS Remote State)

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

---

## 8. One-Click Quickstart (`make deploy`)

The fastest way to deploy the entire stack from scratch:

```bash
cd infra
make deploy
```

### What `make deploy` executes automatically:
1. **Initializes & Runs Terraform**: Provisions the `e2-micro` VM, 30 GB standard disk, and firewall rules for ports 8000, 80, and 443.
2. **Dynamic Inventory Sync**: Resolves the VM's external IP address and updates Ansible's `inventory.ini`.
3. **Waits for SSH**: Polls port 22 until the instance is reachable.
4. **Runs Ansible Playbook**: Installs Docker & Docker Compose, deploys Icecast, Liquidsoap, and Caddy reverse proxy configs, downloads fallback audio, and starts containers.
5. **Performs Health Check**: Confirms both Icecast and Caddy endpoints are responding with valid HTTP status codes.

---

## 9. Operational Command Reference

All daily operations can be run with standard `make` targets from the `infra/` folder:

| Command | Action | Description |
| :--- | :--- | :--- |
| `make help` | Display Guide | Prints all available commands and descriptions. |
| `make deploy` | **Full Pipeline** | Runs Terraform $\rightarrow$ Updates IP $\rightarrow$ Executes Ansible $\rightarrow$ Healthcheck. |
| `make plan` | Terraform Preview | Runs `terraform plan` to view planned infrastructure changes without applying. |
| `make apply` | Terraform Apply | Applies infrastructure changes directly via Terraform. |
| `make ansible` | Configuration Only | Re-runs the Ansible playbook against the live VM without touching cloud resources. |
| `make status` | Health Inspection | Displays live container status (Icecast, Liquidsoap, Caddy) on the VM. |
| `make logs` | Tail Live Logs | Follows real-time logs from Icecast, Liquidsoap, and Caddy to inspect rotation and SSL. |
| `make destroy` | Cloud Teardown | Tears down the GCP VM and firewall rules when no longer needed. |

---

## 10. Troubleshooting & FAQs

### Q: Why did the audio player fail before adding Caddy?
**A:** Modern browsers enforce **Mixed Content Blocking** when an HTTPS site (`https://promptfm.live`) tries to load an unencrypted `http://` audio stream. Additionally, cross-origin audio streaming requires permissive CORS headers (`Access-Control-Allow-Origin: *`). Caddy solves both by terminating TLS on port 443 with Let's Encrypt and adding CORS headers before reverse-proxying to Icecast.

### Q: How do I verify Caddy SSL status?
Check Caddy logs directly from your terminal:
```bash
cd infra && make logs
# or via SSH:
gcloud compute ssh promptfm-streamer --command="sudo docker logs promptfm-caddy"
```
Look for: `certificate obtained successfully` and `serving initial configuration`.

### Q: Why does `apt-get` or the VM feel slow during the initial boot?
**A:** `e2-micro` instances utilize shared-core burstable CPUs with 1 GB of RAM and standard spinning HDDs (`pd-standard`) to remain strictly within Google's $0 Always Free tier. Package installations during first boot take ~3–4 minutes. Once Docker and the containers are pulled, day-to-day audio streaming requires less than 8% CPU.

### Q: How do I test the live stream from terminal?
Using `curl` or `mpv`:
```bash
# Test HTTP headers and CORS
curl -sI https://stream.promptfm.live/stream.mp3

# Play stream directly in terminal
mpv https://stream.promptfm.live/stream.mp3
```
