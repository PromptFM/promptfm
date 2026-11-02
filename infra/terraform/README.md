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
* `external_ip`: Public IP of the stream server.
* `icecast_stream_url`: `http://<IP>:8000/stream.mp3`
* `icecast_admin_url`: `http://<IP>:8000/admin/`

