# 📻 PromptFM — 24/7 AI Music Radio & Creator Community

[![Production](https://img.shields.io/badge/Production-promptfm.live-10b981?style=for-the-badge&logo=vercel)](https://promptfm.live)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/alextrifan/promptfm)
[![System Status](https://img.shields.io/endpoint?url=https://promptfm.live/api/status?format=badge&style=for-the-badge)](https://promptfm.live/status)
[![CI Quality & Security Gate](https://github.com/PromptFM/promptfm/actions/workflows/ci.yml/badge.svg?branch=main&style=for-the-badge)](https://github.com/PromptFM/promptfm/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/Tests-489%20Passing-brightgreen?style=for-the-badge&logo=vitest)](https://github.com/PromptFM/promptfm)
[![Mutation Score](https://img.shields.io/badge/Stryker%20Mutation-Core%20Domain-blueviolet?style=for-the-badge)](https://github.com/PromptFM/promptfm)
[![GCP Free Tier](https://img.shields.io/badge/GCP%20Always--Free-$0.00%2Fmo-4285F4?style=for-the-badge&logo=googlecloud)](https://console.cloud.google.com/?project=promptfm-radio-1793623670)
[![LOGS](https://img.shields.io/badge/LOGS-Cloud%20Logging-E37400?style=for-the-badge&logo=googlecloud&logoColor=white)](https://console.cloud.google.com/logs/query?project=promptfm-radio-1793623670)
[![LOGS_VERCEL](https://img.shields.io/badge/LOGS_VERCEL-Runtime%20Logs-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/alextrifan/promptfm/logs)
[![FLAGS_VERCEL](https://img.shields.io/badge/FLAGS_VERCEL-Feature%20Flags-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/alextrifan/promptfm/flags)
[![DASHBOARDS_GCP](https://img.shields.io/badge/DASHBOARDS_GCP-Cloud%20Monitoring-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670)
[![DASHBOARDS_VERCEL](https://img.shields.io/badge/DASHBOARDS_VERCEL-Vercel%20Analytics-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/alextrifan/promptfm/analytics)
[![SPEED_INSIGHTS_VERCEL](https://img.shields.io/badge/SPEED_INSIGHTS-Vercel%20Speed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/alextrifan/promptfm/speed-insights)
[![TRACES_GCP](https://img.shields.io/badge/TRACES_GCP-Cloud%20Trace-34A853?style=for-the-badge&logo=googlecloud&logoColor=white)](https://console.cloud.google.com/traces/overview?project=promptfm-radio-1793623670)
[![License](https://img.shields.io/badge/License-Community%20Source--Available-purple?style=for-the-badge)](LICENSE)

**PromptFM** is an autonomous 24/7 AI-generated music radio platform and community chart. Featuring **5 live theme stations** (including After Dark 18+ Explicit with statutory legal age verification), continuous uninterrupted **100% pure music rotation**, real-time listener voting, and direct MP3/M4A creator uploads with automatic ID3 metadata and album art extraction.

---

## 📊 Live Monitoring & Operational Dashboards

PromptFM is engineered to operate strictly within 100% zero-cost cloud tiers. Use the following direct dashboard links to monitor live listener traffic, system usage, and API quotas:

| Dashboard | Direct Console Link | What It Monitors | Cost |
| :--- | :--- | :--- | :--- |
| **GCP Cloud Monitoring** | [PromptFM 0-Cost Telemetry Dashboard](https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670) | Gemini 3.5 Flash requests & quotas, Gemini 2.5 Flash TTS synthesis latencies, Cloud Storage operations, service uptime | **$0.00** (Free Tier) |
| **GCP Cloud Logging** | [Cloud Logging Console](https://console.cloud.google.com/logs/query?project=promptfm-radio-1793623670) | Real-time VM streamer logs, Liquidsoap transitions, Icecast access/error logs, and structured JSON stdout | **$0.00** (50GB/mo Free) |
| **GCP Cloud Trace** | [Cloud Trace Overview](https://console.cloud.google.com/traces/overview?project=promptfm-radio-1793623670) | Distributed W3C trace latency across API requests, TTS synthesis spans, and Supabase RPC calls | **$0.00** (Free Tier) |
| **Vercel Web Analytics** | [Vercel Realtime Analytics](https://vercel.com/alextrifan/promptfm/analytics) | Live visitors online, real-time listener telemetry, page views, iOS Safari homescreen users, referral sources, Core Web Vitals | **$0.00** (Hobby Plan) |
| **Vercel Speed Insights** | [Vercel Speed Insights](https://vercel.com/alextrifan/promptfm/speed-insights) | Real User Monitoring (RUM), Core Web Vitals (LCP, FID, CLS, INP, TTFB) by route and device score | **$0.00** (Included) |
| **Vercel Runtime Logs** | [Vercel Function Logs](https://vercel.com/alextrifan/promptfm/logs) | Real-time edge and serverless execution logs, API route latencies, and streaming errors | **$0.00** (Included) |
| **Vercel Feature Flags** | [Vercel Flags Console](https://vercel.com/alextrifan/promptfm/flags) | Real-time feature flags, emergency kill-switches, AI DJ monologue prompt experiments, and canary channel rollouts | **$0.00** (Included) |
| **Google AI Studio** | [Gemini AI Studio Dashboard](https://aistudio.google.com) | Gemini API free key quota usage (15 RPM / 1,500 requests/day free allowance) under `Gemini Project` (`gen-lang-client-0217883943`) | **$0.00** |
| **Station Manager Studio** | [promptfm.live/admin](https://promptfm.live/admin) | On-air queue curation, community submission moderation, Discord/Telegram batch requests, manual DJ voice drops, channel management | **$0.00** |
| **Icecast 2 Stream Admin** | [stream.promptfm.live:8000/admin](http://stream.promptfm.live:8000/admin/) | Direct Icecast mount points (`/stream.mp3`, `/cyberpunk.mp3`, `/chillout.mp3`, `/kids.mp3`, `/afterdark.mp3`), connected socket listeners, bitrate telemetry | **$0.00** (GCP VM) |

### 🚩 Vercel Feature Flags & Real-Time Kill-Switches
Station administrators can manage production feature flags, rollout canary channels, toggle experimental Gemini AI DJ prompts, or trigger emergency kill-switches instantly without deploying code or redeploying edge containers:
- **Direct Admin Console**: [https://vercel.com/alextrifan/promptfm/flags](https://vercel.com/alextrifan/promptfm/flags)
- **Instant Kill-Switches**: Instantly halt creator audio uploads, voting APIs, or live stream feeders during upstream provider outages with 0 latency.
- **AI DJ Monologue Experimentation**: Dynamically route traffic between Gemini 3.5 Flash prompt variations to evaluate conversational pacing and engagement.
- **Zero-Downtime Canary Channels**: Toggle access to experimental theme stations (e.g. Ambient Synthwave, Lo-Fi Study Beats) for select cohorts before general release.

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
# Run Vitest test suite (unit & integration tests)
npm test

# Run tests affected by current git branch/diff
npm run test:changed

# Run tests related to specific files
npm run test:related src/lib/audio/player-controller.ts

# Run test suite with code coverage
npm run test:coverage

# Run Targeted Stryker Mutation Testing (fast - runs on modified domain code only)
npm run test:mutate:affected

# Run Full Stryker Mutation Testing (comprehensive domain baseline audit)
npm run test:mutate

# Validate TypeScript typings
npm run typecheck

# Production Next.js build
npm run build
```

---

## 💻 Unified PromptFM CLI (`npm run promptfm`)

Station managers, creators, and operators can manage the station directly from the terminal via [`scripts/promptfm.ts`](scripts/promptfm.ts):

```bash
# Upload an audio track into active rotation (auto-extracts ID3, album art, lyrics, pgvector)
npm run promptfm -- upload /path/to/song.mp3 --title "Title" --artist "Artist" --category "Synthwave & Electro" --votes 32

# Check what's playing live on air right now
npm run promptfm -- now

# View the upcoming airplay queue
npm run promptfm -- next

# Display 24/7 musical programming schedule & clock wheels
npm run promptfm -- schedule

# Search tracks by natural language vibe (768-dim pgvector RAG)
npm run promptfm -- vibe "dreamy synthwave with nostalgic vocals"

# Stream live radio audio directly in terminal (requires mpv or ffplay)
npm run promptfm -- listen
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

### 2. Multi-Channel Permitted Broadcast Matrix & Main Stage Eligibility

PromptFM routes tracks strictly based on station guardrails and parental control rules in [`src/lib/dj/roster.ts`](src/lib/dj/roster.ts) and [`src/lib/safety/channel-guardrails.ts`](src/lib/safety/channel-guardrails.ts):

| Channel | Slug | Audience / Policy | Explicit (18+) Allowed? | Kids Songs Allowed? |
|---|---|---|---|---|
| **Ch 1: Main Stage** | `main` | General audience prime rotation | Only during Late Night Watershed (22:00–05:00 UTC) | ❌ Excluded (Isolated strictly to `kids`) |
| **Ch 2: Cyberpunk & Synth** | `cyberpunk` | High energy, gritty industrial | Only during Late Night Watershed (22:00–05:00 UTC) | ❌ Excluded |
| **Ch 3: Chillout & Ambient** | `chillout` | Safe, relaxing, study beats | ❌ Blocked 24/7 | ❌ Excluded |
| **Ch 4: Kids & Family** | `kids` | COPPA-compliant, child-safe | ❌ Blocked 24/7 | ✅ Allowed & Prioritized (`family_friendly: true`) |
| **Ch 5: After Dark** | `afterdark` | 🔞 18+ Mature, uncensored | ✅ Permitted 24/7 (Mandatory Age Gate) | ❌ Excluded |

#### How Main Stage Selection Works:
1. **Approval Gatekeeper:** Only tracks marked `status: 'approved'` in the database are ever selected.
2. **Category Isolation (Kids vs Main Stage):** Educational, nursery, and children's tracks (e.g. category `Kids & Family` or titled `Alphabet Song`) are **strictly isolated to `kids`**. They never air on Main Stage or general theme channels.
3. **Queue Hierarchy on Main Stage:**
   - **Priority 1 (Live Listener Requests):** Pending `/song <vibe>` requests queued by listeners on Telegram, Discord, or Web via [`src/lib/dj/batches.ts`](src/lib/dj/batches.ts).
   - **Priority 2 (Top-Chart Community Rotation):** Filtered against `isContentAllowedForAirplay()` and ordered by `upvotes_count DESC`.
   - **Priority 3 (Weighted Random Rotation):** Tracks in the top 5 receive 4x selection weight, ranks 6–15 receive 2x weight, and remaining top-40 library tracks receive 1x weight.

---

## 💬 Discord Bot & Interactions Webhook Integration Guide

PromptFM supports native Discord Application Slash Commands and Button Interactions through a single serverless endpoint at `https://promptfm.live/api/bot/webhook`.

### How to Connect Discord:
1. **Discord Developer Portal:**
   - Go to [discord.com/developers/applications](https://discord.com/developers/applications) and select your Application.
   - In **General Information**, find **"Interactions Endpoint URL"**.
   - Enter `https://promptfm.live/api/bot/webhook` and click **Save Changes**.
   - *PromptFM automatically handles Discord's cryptographic Ping/Pong verification (`type: 1 -> { type: 1 }`).*
2. **Bot Permissions & OAuth2 Scopes:**
   - Go to **OAuth2 -> URL Generator**.
   - Scopes: `bot`, `applications.commands`.
   - Bot Permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`.
   - Use the generated URL to invite the bot to your Discord server.
3. **Configure Environment Variables (`.env.local`):**
   ```bash
   DISCORD_APPLICATION_ID="your-discord-app-id"
   DISCORD_BOT_TOKEN="your-discord-bot-token"
   DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." # For channel broadcast cards in #now-playing
   ```
4. **Register Slash Commands & Shorthands:**
   Run the unified CLI command to register all 10 slash commands and 9 shorthands with Discord's REST API:
   ```bash
   npm run promptfm -- bot discord setup <DISCORD_APPLICATION_ID> <DISCORD_BOT_TOKEN>
   ```
   Users can now type `/nowplaying`, `/song <vibe>`, `/queue`, `/dedicate`, `/help` or shorthands (`/np`, `/q`, `/s`, `/d`, `/w`, `/z`, `/r`, `/h`) in `#now-playing`!

---

## 🐦 Multi-Platform Admin Broadcasting (X / Twitter, Discord, Telegram)

Station admins and AI agents can automatically post live announcements, chart updates, and on-air alerts to **X (formerly Twitter)** `@promptfm_live`, Discord, and Telegram across 3 unified interfaces:

### 1. Terminal CLI (`npm run promptfm`)
```bash
# Post directly to X (Twitter):
npm run promptfm -- x post "Tune in live on PromptFM: DJ Neon is spinning the weekly Top 10! https://promptfm.live"

# Broadcast to Discord, Telegram, and X simultaneously:
npm run promptfm -- broadcast "Live broadcast update: Fresh AI synth tracks added!" --x
```

### 2. Web Studio Admin Console (`/admin`)
- Navigate to **`https://promptfm.live/admin`** -> click the **Social Broadcast (X / Discord / Telegram)** tab.
- Compose your message with a real-time 280-character countdown for X.
- Toggle destinations: `[x] X (Twitter)`, `[x] Discord`, `[x] Telegram`.
- Click **"Post Broadcast to Selected Networks"**.

### 3. Model Context Protocol (MCP) Tools
AI agents (Cursor, Claude Desktop, Antigravity, Windsurf) can publish broadcasts autonomously:
```json
// Tool: promptfm_admin_post_tweet
{
  "text": "Top 10 AI Tracks of the week are live now on PromptFM Main Stage! Tune in: https://promptfm.live/top"
}

// Tool: promptfm_admin_broadcast (with post_to_x: true)
{
  "message": "Breaking music drop: New tracks added to Cyberpunk rotation!",
  "post_to_x": true
}
```

> [!NOTE]
> **Zero-Cost & Dev Fallback Mode:** When X API credentials (`X_API_KEY`, `X_ACCESS_TOKEN`, or `X_BEARER_TOKEN`) are not yet present in `.env.local`, PromptFM automatically provides a clean simulated log (`[X:DevFallback]`), allowing full end-to-end testing with $0 cloud cost. Simply add your keys to go live on production!

### 3. Station Gatekeeper Review
All community submissions via `/submit` are saved with `status: 'pending'`. They never enter the active radio airplay rotation until a station admin reviews the audio preview, ID3 metadata, embedded lyrics, and AI safety badges in `/admin` and clicks **Approve for Airplay**.

---

## 🤖 Model Context Protocol (MCP) & Community Bridges

PromptFM exposes a streamable **Model Context Protocol (MCP)** server at [`https://promptfm.live/api/mcp`](https://promptfm.live/api/mcp) supporting both Public Listener Mode and Station Admin Mode.

- **Listener Commands & Schedule Guide:** [`docs/listener-guide.md`](docs/listener-guide.md) (Discord & Telegram prompts, clock wheels, and queueing).
- **MCP Integration Guide:** [`docs/mcp-integration-guide.md`](file:///Users/trifan/DEVELOPMENT/promptfm/docs/mcp-integration-guide.md) (Claude Desktop, Cursor, Antigravity, Windsurf).
- **Public Tools:** Natural language vibe search (`promptfm_search_tracks_by_vibe`), chart rankings, live DJ status, song requests, and safety reporting.
- **Admin Tools (`ADMIN_API_KEY`):** Moderation review, voice drop generation, live broadcast alerts, sponsor injection, and channel provisioning.
- **Discord Community:** [`https://discord.gg/promptfm`](https://discord.gg/promptfm) (Now Playing updates, live DJ transcripts, 1-click voting).
- **Telegram Bot:** [`https://t.me/PromptFMBot`](https://t.me/PromptFMBot) (Interactive `/nowplaying`, `/song`, `/dedicate`, `/weather`, and inline upvoting).

---

## 👥 Community Development & Governance

PromptFM welcomes open community development, bug fixes, and feature proposals!

- **Contributing Guide:** See [`CONTRIBUTING.md`](CONTRIBUTING.md) for full instructions on local setup, running tests, mutation testing, and submitting pull requests.
- **Code of Conduct:** Read our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community standards, respectful collaboration, and enforcement guidelines.
- **Security Policy:** See [`SECURITY.md`](SECURITY.md) for vulnerability disclosure, safe harbor terms, and reporting guidelines.
- **Accessibility Statement:** Review [`ACCESSIBILITY.md`](ACCESSIBILITY.md) for WCAG 2.1 AA conformance, keyboard navigation shortcuts, and screen reader compatibility.
- **Licensing:** Governed by the [`PromptFM Community Source-Available License (Version 1.0)`](LICENSE). You may inspect, fork, test, and contribute pull requests. You may **not** copy, extract, resell, or host competing radio/streaming clones.
- **Review Board:** All pull requests require review and approval from the Board (**@atrifan**).
- **GitHub Organization:** Community development is hosted under the `promptfm` organization.
- **Tag-Triggered Deployments:** To protect our $0 infrastructure budget and prevent burning Vercel Fluid Active CPU, routine merges to `main` run CI quality checks but do NOT auto-deploy to production. Production deployments are triggered exclusively via release tags (`promptfm/<version>` or `v*.*.*`) targeting the `production` environment on Vercel. Documentation updates deploy via `gh-pages/<version>` to GitHub Pages.
- **Security & Secret Sharing:** Never post secrets or API keys in PRs or issues. For new environment variables, use ephemeral links ([Password Pusher](https://pwpush.com)) shared directly with @atrifan.

---

## 🩺 System Status & Health Telemetry

PromptFM features real-time operational health checks probing all 5 core station systems:
- **Live Status Webpage:** [`https://promptfm.live/status`](https://promptfm.live/status) — Interactive status dashboard with real-time response latency metrics (ms) and 30-day uptime percentage.
- **Health Check JSON API:** `GET https://promptfm.live/api/status` — Returns machine-readable JSON status report (`operational`, `degraded`, `outage`) with edge-caching (`s-maxage=10`).
- **Dynamic Shields.io Badge:** `GET https://promptfm.live/api/status?format=badge` — Generates a live SVG badge for GitHub readmes and external dashboards.
- **Automated Uptime Actions:** [`.github/workflows/uptime.yml`](.github/workflows/uptime.yml) executes a 30-minute health probe workflow completely free on the GitHub Actions public repository tier.

---

## 💰 Transparent Funding, Music Licensing & Multi-Rail Donations

PromptFM is an independent project. To maintain 100% legal compliance and operational transparency, all community contributions and sponsorships are directly budgeted:

| Allocation | Percentage | Purpose |
| :--- | :--- | :--- |
| **Radio & Music Royalties** | **35%** | Statutory licensing fees (ASCAP, BMI, SESAC, SoundExchange / StreamLicensing) to legally broadcast commercial licensed tracks alongside AI-generated music. |
| **Cloud & Audio Streaming** | **25%** | 24/7 continuous Icecast audio streaming servers, GCP Cloud Run compute, audio object storage, and Vercel edge delivery. |
| **Generative AI & Voice Compute** | **20%** | Gemini 1.5/2.0 API prompt tokens for real-time DJ banter scripting, weather/news synthesizers, and neural TTS voice generation credits. |
| **Engineering & Development** | **15%** | Dedicated development time maintaining audio pipelines, listener bots, Discord & Telegram bridges, and mobile apps. |
| **Maintainer Fuel (Coffee)** | **5%** | Espresso and coffee powering late-night bug triage, production monitoring, and community support. |

### Supported Donation Rails
- **Stripe Checkout:** Direct card, Apple Pay, and Google Pay support via [Stripe Donation](https://donate.stripe.com/6oUaEYdUpa9zgEA2H3cQU00).
- **PayPal.Me:** Direct 1-click tips via [paypal.me/promptfm](https://paypal.me/promptfm).
- **GitHub Sponsors:** 0% platform fee developer patronage at [github.com/sponsors/PromptFM](https://github.com/sponsors/PromptFM).
- **Ko-fi:** 1-click tips via Apple Pay, Google Pay, and PayPal at [ko-fi.com/promptfm](https://ko-fi.com/promptfm).
- **Bitcoin (BTC):** Direct on-chain contribution on Bitcoin Mainnet only to `bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9` ([View on Mempool](https://mempool.space/address/bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9)).
- **Ethereum / USDC:** Direct ERC-20 & ETH contribution on Ethereum Mainnet only to `0x9581F969727Ff987958d050C80662578C50F6A9f` ([View on Etherscan](https://etherscan.io/address/0x9581F969727Ff987958d050C80662578C50F6A9f)).

---

## 📡 $0-Cost Structured Logging & Distributed Tracing

PromptFM maximizes observability without incurring third-party SaaS fees (no Datadog or Splunk bills):
- **Google Cloud Logging (50 GB/month FREE):** Ingests single-line JSON logs emitted to stdout/stderr. Automatically indexes `severity`, `logging.googleapis.com/trace`, `httpRequest`, and `serviceContext` attributes.
- **Vercel Runtime Logs ($0 Hobby / Pro):** Streams real-time function execution logs in the Vercel dashboard. Parsed as structured JSON attributes directly from stdout.
- **W3C Distributed Tracing:** All incoming requests are assigned or inherit a 32-hex `traceId` and 16-hex `spanId` (via `traceparent`, `x-request-id`, or `x-cloud-trace-context`). Propagated across Next.js APIs, Icecast streamer, and AI generation calls for instant end-to-end trace correlation.
- **Isomorphic Logger:** Accessible via [`src/lib/telemetry/logger.ts`](src/lib/telemetry/logger.ts) supporting `logger.info()`, `logger.warn()`, `logger.error()`, and contextual child loggers `logger.child({ traceId, component })`.

---

## 🚀 Zero-Friction Release Automation & Tag-Based Deployment Gate

To eliminate release bottlenecks and protect our free-tier compute budget:
1. **Protected $0 Budget Policy:** Merges to `main` run CI verification (Vitest, Typecheck, Lint, Security) but do NOT auto-deploy to Vercel production. This preserves Vercel's included 4 hours/month Fluid Active CPU.
2. **Pre-Build Ignore Hook (`scripts/vercel-budget-gate.js`):** Enforces Vercel's `ignoreCommand` to cancel untagged `main` builds in 2–3s with exit code `0` (0 active CPU seconds consumed).
3. **Automated Production Release Tags:** Pushing a semantic release tag (e.g. `git tag promptfm/v1.0.0 && git push origin promptfm/v1.0.0` or `v1.0.0`) triggers [`.github/workflows/release.yml`](.github/workflows/release.yml).
4. **Vercel Deploy Hook Integration:** Tag releases trigger Vercel's production deployment using the `promptfm-release` deploy hook (stored securely in GitHub Actions as `VERCEL_DEPLOY_HOOK`).
5. **GitHub Deployment Status (Checkmark!):** The workflow packages the release, executes the quality gate (Vitest + Typecheck), triggers/verifies Vercel production deployment, and stamps the Git tag with an official green checkmark (`Environment: production – Active`).
6. **Documentation Releases:** Pushing a `gh-pages/<version>` tag (e.g. `gh-pages/v1.0.0`) deploys the documentation portal to GitHub Pages via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
7. **Automated Changelog:** GitHub Release notes are automatically generated from commit history with zero manual release drafting friction.
8. **Operational Runbook:** See [Station Admin Guide — Section E](docs/admin-guide.md#e-tag-based-release-operations-runbook-issue-123) for deploy hook CLI management and emergency override procedures.



