# 24/7 PromptFM Stream Server on Google Cloud Always-Free Tier ($0.00 / Month)

This document specifies the exact architecture, cost-safeguard boundaries, and step-by-step setup to host the PromptFM 24/7 continuous audio stream server on Google Cloud Platform with **zero ongoing cost**.

> **This GCP host is retired.** The stream moved to Oracle Cloud on 2026-11-09: GCP only includes 1 GB/month of outbound traffic, and one 128 kbps listener is about 41 GB/month, while Oracle's Always Free tier includes about 10 TB/month. The VM `promptfm-streamer` is stopped and its public 80/443 firewall rule is removed. This document is kept as the record of how the GCP host was built. To put the stream back on it, see [infra-overview.md](infra-overview.md) (`infra/converge-stream.sh gcp`, or the Rollback Infrastructure workflow).

---

## 1. The Google Cloud "Always Free" Limits

Google Cloud provides an Always Free tier for Compute Engine that never expires. To ensure the bill is strictly **$0.00/month**, all infrastructure must stay within these exact specifications:

| Parameter | Free Tier Limit | PromptFM Configuration | Compliance |
| :--- | :--- | :--- | :---: |
| **Instance Count** | 1 non-preemptible VM per billing account | 1 VM (`promptfm-streamer`) | ✅ |
| **Machine Type** | `e2-micro` (2 vCPU, 1 GB RAM, burstable) | `e2-micro` | ✅ |
| **Region** | `us-central1` (Iowa), `us-east1` (SC), or `us-west1` (Oregon) | `us-central1-a` | ✅ |
| **Disk Type** | Standard Persistent Disk (`pd-standard`) | `pd-standard` | ✅ |
| **Disk Size** | Up to 30 GB total across project | 30 GB boot disk | ✅ |
| **External IPv4** | Ephemeral IPv4 only (Static reserved IPv4 costs ~$3/mo) | Ephemeral | ✅ |
| **Network Egress** | 1 GB/month free to internet (Overages: ~$0.085/GB) | Every listener byte counts; one listener is ~41 GB/month | ❌ (over 1 GB) |

---

## 2. Egress on GCP

A 24/7 audio broadcast at 128 kbps produces:
$$\text{Bandwidth per listener} = 128\text{ kbps} = 16\text{ KB/sec} \approx 41.5\text{ GB / month}$$

GCP includes 1 GB/month of outbound traffic to the internet. One continuous listener is already about 41 GB/month, and 10 listeners are about 415 GB/month (overage about $0.085/GB).

### A Cloudflare Tunnel does not remove this
```
Listeners ──► Cloudflare Edge ──► cloudflared (on the VM) ──► Icecast
                    ▲                      │
                    └──────────────────────┘
          the audio still leaves the VM through GCP's network
```

1. The Icecast server binds only to `localhost:8000`.
2. A `cloudflared` container opens an outbound tunnel to Cloudflare, and Cloudflare forwards each listener's request through it.
3. Every byte a listener receives is sent by Icecast, through the tunnel, out of the VM. GCP bills it as outbound traffic.
4. Cloudflare can cache static files, but a live stream is not cacheable, so the tunnel does not reduce the bytes the VM sends.
5. Cloudflare adds TLS and DDoS protection. It does not make GCP egress free.

This is why the stream moved to Oracle Cloud, where the free outbound allowance covers it. See [Oracle Always Free streamer](oracle-always-free-streamer.md).

---

## 3. Step-by-Step CLI Execution Plan

### Step 1: Enable Compute Engine API
```bash
gcloud services enable compute.googleapis.com
```

### Step 2: Create the `e2-micro` Instance
```bash
gcloud compute instances create promptfm-streamer \
    --project="promptfm-radio-1793623670" \
    --zone="us-central1-a" \
    --machine-type="e2-micro" \
    --image-family="ubuntu-2404-lts-amd64" \
    --image-project="ubuntu-os-cloud" \
    --boot-disk-size="30GB" \
    --boot-disk-type="pd-standard" \
    --tags="http-server,https-server" \
    --metadata="startup-script=apt-get update && apt-get install -y docker.io docker-compose"
```

### Step 3: Deploy the Streamer Stack
Clone or copy the files in [`deploy/streamer`](file:///Users/trifan/DEVELOPMENT/promptfm/deploy/streamer) to the VM and run:
```bash
docker-compose up -d
```

