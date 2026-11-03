# 📻 PromptFM — 24/7 AI Music Radio & Creator Community

[![Production](https://img.shields.io/badge/Production-promptfm.live-10b981?style=for-the-badge&logo=vercel)](https://promptfm.live)
[![Tests](https://img.shields.io/badge/Tests-224%20Passing-brightgreen?style=for-the-badge&logo=vitest)](https://github.com/atrifan/promptfm)
[![Mutation Score](https://img.shields.io/badge/Stryker%20Mutation-%E2%89%A587%25-blueviolet?style=for-the-badge)](https://github.com/atrifan/promptfm)
[![GCP Free Tier](https://img.shields.io/badge/GCP%20Always--Free-$0.00%2Fmo-4285F4?style=for-the-badge&logo=googlecloud)](https://console.cloud.google.com/?project=promptfm-radio-1793623670)
[![License](https://img.shields.io/badge/License-MIT-zinc?style=for-the-badge)](LICENSE)

**PromptFM** is an autonomous 24/7 AI-generated music radio platform and community chart. Featuring **4 live theme stations**, continuous **AI radio DJs** delivering spoken commentary and weather updates, real-time listener voting, and direct MP3/MP4 creator uploads with automatic ID3 metadata and album art extraction.

---

## 📊 Live Monitoring & Operational Dashboards

PromptFM is engineered to operate strictly within 100% zero-cost cloud tiers. Use the following direct dashboard links to monitor live listener traffic, system usage, and API quotas:

| Dashboard | Direct Console Link | What It Monitors | Cost |
| :--- | :--- | :--- | :--- |
| **Google Cloud Monitoring** | [PromptFM 0-Cost Telemetry Dashboard](https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670) | Gemini 3.5 Flash requests & quotas, Gemini 2.5 Flash TTS synthesis latencies, Cloud Storage operations, service uptime | **$0.00** (Free Tier) |
| **Vercel Web Analytics** | [Vercel Realtime Analytics](https://vercel.com/alex-trifans-projects/promptfm/analytics) | Live visitors online, real-time listener telemetry, page views, iOS Safari homescreen users, referral sources, Core Web Vitals | **$0.00** (Hobby Plan) |
| **Google AI Studio** | [Gemini AI Studio Dashboard](https://aistudio.google.com) | Gemini API free key quota usage (15 RPM / 1,500 requests/day free allowance) under `Gemini Project` (`gen-lang-client-0217883943`) | **$0.00** |
| **Station Manager Studio** | [promptfm.live/admin](https://promptfm.live/admin) | On-air queue curation, community submission moderation, Discord/Telegram batch requests, manual DJ voice drops, channel management | **$0.00** |
| **Icecast 2 Stream Admin** | [stream.promptfm.live:8000/admin](http://stream.promptfm.live:8000/admin/) | Direct Icecast mount points (`/stream.mp3`, `/cyberpunk.mp3`, `/chillout.mp3`, `/kids.mp3`), connected socket listeners, bitrate telemetry | **$0.00** (GCP VM) |

---

## 🏗️ Architecture & Cloud Infrastructure

PromptFM combines a **Next.js 14 App Router** frontend/API with an autonomous **Always-Free GCP Streamer VM** and Supabase PostgreSQL backend:

```
                                [Listener Web / iPhone PWA]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
                       ▼ HTTPS (Port 443)                          ▼ HTTPS
          ┌───────────────────────────┐               ┌───────────────────────────┐
          │   stream.promptfm.live    │               │       promptfm.live       │
          │ (GCP Compute Engine Free) │               │   (Vercel Edge Network)   │
          └─────────────┬─────────────┘               └─────────────┬─────────────┘
                        │                                           │
         ┌──────────────┴──────────────┐             ┌──────────────┴──────────────┐
         │ Caddy 2 Reverse Proxy (SSL) │             │ Next.js 14 Serverless APIs  │
         │  ├── Icecast 2.4.4 Server   │             │  ├── /api/radio/now         │
         │  └── Liquidsoap 2.2.5 Cross ├──Queries───►│  ├── /api/radio/next        │
         └─────────────────────────────┘   Stream    │  └── /api/admin/*           │
                                                     └──────────────┬──────────────┘
                                                                    │
                                                     ┌──────────────┴──────────────┐
                                                     │  Gemini 3.5 & 2.5 Flash TTS │
                                                     │  Supabase DB & Cloudflare R2│
                                                     └─────────────────────────────┘
```

---

## 🛠️ Infrastructure as Code (Terraform & Ansible)

The complete streaming server infrastructure and Google Cloud Monitoring dashboards are defined as code in [`infra/`](infra):

### 1. Terraform (`infra/terraform/`)
- **Remote State:** Google Cloud Storage (`gs://promptfm-tfstate-promptfm-radio-1793623670`) in `us-central1` (100% covered by GCP's 5 GB free storage).
- **Compute Engine:** Always-Free `e2-micro` instance (1 GB RAM, 30 GB standard persistent disk).
- **Firewall Rules:** Ingress ports `80` (HTTP-01 challenge), `443` (Caddy TLS stream), and `8000` (Icecast).
- **Telemetry Dashboard:** Provisions `google_monitoring_dashboard.telemetry_dashboard` from [`config/gcp-dashboard.json`](config/gcp-dashboard.json).

### 2. Ansible (`infra/ansible/`)
- Installs Docker, Docker Compose, and Caddy reverse proxy.
- Deploys multi-channel Icecast 2 configuration and Liquidsoap radio crossfader script.
- Verifies stream health and outputs all operational dashboard URLs.

### One-Click Deployment
```bash
# Navigate to infrastructure directory
cd infra

# Plan and provision GCP resources + Monitoring Dashboard
make plan
make apply

# Or run the complete automated pipeline (Terraform + Ansible)
make deploy
```

---

## 🎵 Key Features

### 1. 4 Live Theme Channels
- **Main Stage (`main`):** Prime AI pop, rock, electronic, and chart-toppers curated by **DJ Neon**.
- **Cyberpunk & Synth (`cyberpunk`):** Darksynth, retrowave, industrial cyber beats hosted by **DJ Byte**.
- **Chillout & Lo-Fi (`chillout`):** Ambient soundscapes, generative lofi, and study beats with **DJ Velvet**.
- **Kids & Family (`kids`):** Safe, upbeat sing-alongs and stories curated by **DJ Sprout**.

### 2. Autonomous AI DJs & Zero-Cost Voice Synthesis
- Scripts generated in <1s using **Gemini 3.5 Flash** (`thinkingBudget: 0`).
- Audio speech synthesized using **Gemini 2.5 Flash Preview TTS** (`gemini-2.5-flash-preview-tts`), converted from linear PCM to 44-byte RIFF WAV at **100% $0 cost** under the free Gemini API allowance.
- Dynamic broadcast drops: weather reports, breaking news, DJ trivia, dedications, and sponsor announcements.

### 3. Real-Time Listener Telemetry & "Up Next" Queue
- In-memory presence tracking and diurnal baseline algorithm in [`src/lib/radio/listeners.ts`](src/lib/radio/listeners.ts) (**87.32% Stryker mutation score**).
- Real-time **"Listening Now"** counter displayed in the landing hero and sticky player bar.
- Dedicated **Up Next on Air** queue component displaying upcoming tracks, artwork, and upvote scores.

### 4. iPhone Home Screen & PWA Web Clip
- Native 180×180 and 512×512 solid-background Apple Touch icons (`/apple-touch-icon.png`, `/apple-icon.png`).
- Configured Apple Web App standalone metadata (`black-translucent` status bar).
- Web App Manifest (`/manifest.webmanifest`) with maskable icon support.

### 5. Google AdSense & IAB `ads.txt`
- Verified publisher ID `ca-pub-7299057534028491`.
- Live IAB-compliant `ads.txt` route at [`https://promptfm.live/ads.txt`](https://promptfm.live/ads.txt) generated by [`src/lib/ads/adsense.ts`](src/lib/ads/adsense.ts) (**90.48% Stryker score**).
- Non-intrusive, dark-mode responsive AdSense display units.

---

## 🧪 Engineering Mandates & Testing

PromptFM enforces strict **Test-Driven Development (TDD)** and mutation testing across all business logic:

```bash
# Run Vitest test suite (250 unit & integration tests)
npm test

# Run test suite with code coverage
npm run test:coverage

# Run Stryker Mutation Testing (ensures ≥80% mutation score on core logic)
npm run test:mutate

# Validate TypeScript typings
npm run typecheck

# Production Next.js build
npm run build
```

---

## 🔑 Environment Variables Configuration

Copy `.env.local.example` to `.env.local` and configure:

```bash
# Public App Settings
NEXT_PUBLIC_SITE_URL="https://promptfm.live"
NEXT_PUBLIC_STREAM_URL="https://stream.promptfm.live/stream.mp3"
NEXT_PUBLIC_ADMIN_EMAILS="alex@example.com"

# Supabase Database & Auth
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Gemini Free Tier (Google AI Studio)
GEMINI_API_KEY="AIzaSy..."

# Cloudflare R2 Audio Storage
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="promptfm-tracks"
R2_PUBLIC_URL="https://cdn.promptfm.live"

# Google AdSense
NEXT_PUBLIC_ADSENSE_CLIENT_ID="ca-pub-7299057534028491"
```

---

## 📜 Legal & Compliance

- **Copyright & DMCA:** [`https://promptfm.live/copyright`](https://promptfm.live/copyright) & [`/dmca`](https://promptfm.live/dmca)
- **Privacy Policy:** [`https://promptfm.live/privacy`](https://promptfm.live/privacy)
- **Terms of Service:** [`https://promptfm.live/terms`](https://promptfm.live/terms)
- **IAB Ads.txt:** [`https://promptfm.live/ads.txt`](https://promptfm.live/ads.txt)

---

## 🛡️ Automated AI Lyric & Audio Scan & Family-Friendly Safeguards

PromptFM integrates an ultra-token-efficient content scanner powered by **Gemini 3.5 Flash** and zero-token local heuristics:

### 1. Multi-Tier Token & Cost Optimization (Zero-Cost Focus)
1. **Tier 1 (0 Tokens) Instrumental Detection:** Detects empty lyrics or instrumental audio immediately without calling any external API.
2. **Tier 2 (0 Tokens) Local Profanity Pre-Filter:** Instant regex inspection for severe obscenity/profanity. Instantly flags `is_explicit: true` and blocks from safe channels with 0 Gemini tokens consumed.
3. **Tier 3 (~50 Tokens) Compact Gemini 3.5 Flash Analysis:**
   - Truncates sample to $\le 350$ characters.
   - Configured with `thinkingBudget: 0` (no CoT token overhead) and `maxOutputTokens: 25`.
   - Returns structured JSON `{ "explicit": boolean, "family_friendly": boolean }`.
   - Well within Google AI Studio's 1,500 daily free tier requests ($0 cost).

### 2. Multi-Channel Permitted Broadcast Matrix
| Channel | Slug | Safe Policy | Explicit Allowed? | Family-Friendly Required? |
|---|---|---|---|---|
| **Ch 1: Main Stage** | `main` | General audience | Only late night (22:00–06:00 UTC) | No (allows both general clean & family) |
| **Ch 2: Cyberpunk & Synth** | `cyberpunk` | High energy / gritty | Only late night (22:00–06:00 UTC) | No |
| **Ch 3: Chillout & Ambient** | `chillout` | Safe / relaxing | ❌ Blocked 24/7 | No (clean required) |
| **Ch 4: Kids & Family** | `kids` | Strictly child-safe | ❌ Blocked 24/7 | ✅ Strictly required (`family_friendly: true`) |

### 3. Station Gatekeeper Review
All community submissions via `/submit` are saved with `status: 'pending'`. They never enter the active radio airplay rotation until a station admin reviews the audio preview, ID3 metadata, embedded lyrics, and AI safety badges in `/admin` and clicks **Approve for Airplay**.

