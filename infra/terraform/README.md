# PromptFM Terraform Infrastructure (Always-Free Tier)

This Terraform configuration provisions the PromptFM 24/7 continuous radio broadcast infrastructure on Google Cloud Platform while strictly adhering to the **GCP Always Free Tier ($0.00 / Month)**.

---

## 1. Always-Free Tier Cost Guarantee

| Resource | Configuration | Free Tier Boundary | Compliance |
| :--- | :--- | :--- | :---: |
| **Instance Type** | `e2-micro` (2 vCPU, 1 GB RAM) | 1 free instance per billing account | ✅ |
| **Region & Zone** | `us-central1-a` (Council Bluffs, Iowa) | `us-central1`, `us-east1`, or `us-west1` | ✅ |
| **Boot Disk Type** | Standard Persistent Disk (`pd-standard`) | Standard HDD only (NOT pd-balanced/ssd) | ✅ |
| **Boot Disk Size** | 30 GB | Up to 30 GB is Always Free | ✅ |
| **Remote State** | Google Cloud Storage (`STANDARD`) | 5 GB standard GCS storage is Always Free | ✅ |
| **IPv4 Address** | Ephemeral IPv4 | Static reserved IPv4 costs ~$3.60/mo; Ephemeral is $0 | ✅ |

---

## 2. Remote State Backend (100% Free)

Terraform state is stored in a versioned, secure Google Cloud Storage (GCS) bucket in `us-central1`. Because state files are small (~50 KB) and GCP provides **5 GB of Standard GCS storage for free**, state storage is **$0.00 forever** with automatic state locking.

### Initializing Remote State:
Create the state bucket once before first init:
```bash
gcloud storage buckets create gs://promptfm-tfstate-promptfm-radio-1793623670 --location=us-central1
```

*Note: If you prefer local state, comment out the `backend "gcs"` block in [`versions.tf`](versions.tf).*

---

## 3. Quickstart CLI

### Prerequisites
1. [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) authenticated.
2. [Terraform CLI (>= 1.5.0)](https://developer.hashicorp.com/terraform/downloads) installed.

### Commands:
```bash
# 1. Initialize provider and remote GCS state backend
terraform init

# 2. Plan changes
terraform plan -out=tfplan

# 3. Apply infrastructure
terraform apply tfplan

# 4. View outputs
terraform output
```

### Outputs:
* `external_ip`: Public IP of the stream server VM.
* `stream_url`: `https://stream.<domain>/stream.mp3` (audio stream; the Oracle host in `infra/terraform-oci` replaces the GCP one, since GCP only includes 1 GB/month of outbound traffic).
* `internal_icecast_url`: `http://127.0.0.1:8000/stream.mp3` (Internal localhost mount).
* `primary_domain`: Active managed domain name (e.g. `promptfm.live`).
* `dns_state_tracked`: Boolean indicator if declarative DNS state is present in `infra/dns/`.
* `monitoring_dashboard_id`: ID of the 0-cost Google Cloud Monitoring Dashboard.
* `monitoring_dashboard_url`: Direct console URL to view telemetry and API quotas.
* `vercel_analytics_url`: Direct console URL to view real-time web audience telemetry.

---

## 4. Hostinger DNS & Domain Migration Automation

Terraform integrates declarative Hostinger DNS management with local state tracking in `infra/dns/${domain}.state.json`.

### Hostinger Auth Key Configuration:
1. In Hostinger hPanel, go to **Account > API Tokens** and generate an API token with DNS permissions.
2. Provide the token via environment variable or `terraform.tfvars`:
   ```bash
   export TF_VAR_hostinger_api_token="your-hostinger-api-token"
   # or in terraform.tfvars:
   # hostinger_api_token = "your-hostinger-api-token"
   ```
3. When `hostinger_api_token` is provided, Terraform triggers `null_resource.hostinger_dns_sync` whenever the declarative DNS state changes.
4. You can also run the DNS CLI or Ansible playbook directly:
   ```bash
   # Status & diff preview
   HOSTINGER_API_TOKEN="your-token" npm run promptfm -- dns status promptfm.live
   HOSTINGER_API_TOKEN="your-token" npm run promptfm -- dns diff newdomain.com --from promptfm.live

   # Apply to Hostinger API
   HOSTINGER_API_TOKEN="your-token" npm run promptfm -- dns apply promptfm.live
   ```



