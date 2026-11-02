# 24/7 PromptFM Stream Server on Google Cloud Always-Free Tier ($0.00 / Month)

This document specifies the exact architecture, cost-safeguard boundaries, and step-by-step setup to host the PromptFM 24/7 continuous audio stream server on Google Cloud Platform with **zero ongoing cost**.

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
| **External IPv4** | Ephemeral IPv4 only (Static reserved IPv4 costs ~$3/mo) | Ephemeral / Cloudflare Tunnel | ✅ |
| **Network Egress** | 1 GB/month free to internet (Overages: ~$0.085/GB) | **0 GB direct egress** (Cloudflare Tunnel) | ✅ |

---

## 2. The Zero-Egress Bandwidth Architecture

A 24/7 audio broadcast at 128 kbps produces:
$$\text{Bandwidth per listener} = 128\text{ kbps} = 16\text{ KB/sec} \approx 41.5\text{ GB / month}$$

If listeners connect directly to the GCP VM IP, 10 listeners would consume ~415 GB/month and trigger GCP bandwidth charges.

### Solution: Free Cloudflare Tunnel (`cloudflared`)
```
┌────────────────────────────────────────────────────────┐
│                   GCP e2-micro VM                      │
│             (us-central1 — 100% Always Free)           │
│                                                        │
│  ┌────────────────────────┐   Feeds    ┌────────────┐  │
│  │   Liquidsoap Engine    │ ─────────► │  Icecast2  │  │
│  │ (Dynamic crossfader    │  128 kbps  │ (/stream)  │  │
│  │  & PromptFM API client)│   stream   └──────┬─────┘  │
│  └───────────▲────────────┘                   │        │
│              │ Queries API                    │ Local  │
│              │ & fetches MP3s                 │ port   │
│              │                                ▼ 8000   │
│  ┌───────────┴────────────┐            ┌────────────┐  │
│  │ PromptFM Next.js & R2  │            │ cloudflared│  │
│  │ (/api/radio/next)      │            │  (Tunnel)  │  │
│  └────────────────────────┘            └──────┬─────┘  │
└───────────────────────────────────────────────┼────────┘
                                                │ Free Tunnel
                                                ▼
                                   ┌────────────────────────┐
                                   │  Cloudflare Edge CDN   │
                                   │ (stream.promptfm.com)  │
                                   │  $0 Egress to World    │
                                   └────────────┬───────────┘
                                                │
                                                ▼
                                    Listeners & Web Player
```

1. The Icecast server binds only to `localhost:8000`.
2. A lightweight `cloudflared` Docker container initiates an outbound tunnel to Cloudflare Edge.
3. Listeners stream through `https://stream.promptfm.com`.
4. Cloudflare provides **unlimited free egress bandwidth** and automatic SSL certificates.
5. GCP egress from the VM to Cloudflare is virtually zero, keeping monthly costs at **$0.00**.

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
