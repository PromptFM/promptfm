# 📻 PromptFM — 24/7 AI Music Radio & Creator Community

[![Production](./public/badges/production.svg)](https://promptfm.live)
[![System Status](https://promptfm.live/api/status?format=svg)](https://promptfm.live/status)
[![CI Quality & Security Gate](https://github.com/PromptFM/promptfm/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PromptFM/promptfm/actions/workflows/ci.yml)
[![Tests](./public/badges/tests.svg)](https://github.com/PromptFM/promptfm)
[![Mutation Score](./public/badges/mutation.svg)](https://github.com/PromptFM/promptfm)
[![GCP Free Tier](./public/badges/gcp-always-free.svg)](https://console.cloud.google.com/?project=promptfm-radio-1793623670)
[![Oracle Always Free](./public/badges/oracle-always-free.svg)](https://cloud.oracle.com/compute/instances?region=us-ashburn-1)
[![Oracle Quota](./public/badges/oracle-quota-cap.svg)](https://cloud.oracle.com/quotas)
[![LOGS](./public/badges/logs-cloud-logging.svg)](https://console.cloud.google.com/logs/query?project=promptfm-radio-1793623670)
[![DASHBOARDS_GCP](./public/badges/dashboards-gcp.svg)](https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670)
[![DASHBOARDS_ORACLE](./public/badges/dashboards-oracle.svg)](https://cloud.oracle.com/monitoring/metrics-explorer?region=us-ashburn-1)
[![TRACES_GCP](./public/badges/traces-gcp.svg)](https://console.cloud.google.com/traces/overview?project=promptfm-radio-1793623670)
[![License](./public/badges/license.svg)](LICENSE)

**PromptFM** is an autonomous 24/7 AI-generated music radio platform and community chart. Featuring **5 live theme stations** (including After Dark 18+ Explicit with statutory legal age verification), continuous uninterrupted **100% pure music rotation**, real-time listener voting, and direct MP3/M4A creator uploads with automatic ID3 metadata and album art extraction.

The public web app now runs on the repo-owned Oracle OCI path at `promptfm.live` and `www.promptfm.live`. Issue #193 now has end-to-end live proof: release run `42833955213` cut over `promptfm/0.2.4-81e84d9`, rollback run `42858867447` restored `promptfm/rollback-0.2.4-81e84d9`, and forward redeploy run `42862562417` returned production to `promptfm/0.2.4-3a458a8`. The stream stayed live at [`stream.promptfm.live`](https://stream.promptfm.live/stream.mp3).

Right now the public domain serves both the live PromptFM app and the live audio stream. Full web routes such as `/admin`, `/status`, `/api/*`, `/api/mcp`, and the legal/info pages are back on the Oracle OCI path.

---

> ### ☁️ [Oracle Cloud monitor: streamer CPU, outbound traffic and cost &rarr;](https://cloud.oracle.com/monitoring/metrics-explorer?region=us-ashburn-1)
> The 24/7 audio stream runs on Oracle Cloud Always Free (about 10 TB/month outbound free; AMD micro VM, on air since 2026-11-09). Spend is capped at **$0** by a quota policy, with a $1 budget email and a 300 GB/day outbound alarm. [Cost Analysis](https://cloud.oracle.com/account-management/cost-analysis) · [Alarms](https://cloud.oracle.com/monitoring/alarms?region=us-ashburn-1) · [Quota policy](https://cloud.oracle.com/quotas) · [How it works](docs/oracle-always-free-streamer.md)

## 📊 Live Monitoring & Operational Dashboards

PromptFM is engineered to operate strictly within 100% zero-cost cloud tiers. Use the following direct dashboard links to monitor live listener traffic, system usage, and API quotas:

| Dashboard | Direct Console Link | What It Monitors | Cost |
| :--- | :--- | :--- | :--- |
| **GCP Cloud Monitoring** | [PromptFM 0-Cost Telemetry Dashboard](https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670) | Gemini 3.5 Flash requests & quotas, Gemini 2.5 Flash TTS synthesis latencies, Cloud Storage operations, service uptime | **$0.00** (Free Tier) |
| **GCP Cloud Logging** | [Cloud Logging Console](https://console.cloud.google.com/logs/query?project=promptfm-radio-1793623670) | Real-time VM streamer logs, Liquidsoap transitions, Icecast access/error logs, and structured JSON stdout | **$0.00** (50GB/mo Free) |
| **GCP Cloud Trace** | [Cloud Trace Overview](https://console.cloud.google.com/traces/overview?project=promptfm-radio-1793623670) | Distributed W3C trace latency across API requests, TTS synthesis spans, and Supabase RPC calls | **$0.00** (Free Tier) |
| **Google AI Studio** | [Gemini AI Studio Dashboard](https://aistudio.google.com) | Gemini API free key quota usage (15 RPM / 1,500 requests/day free allowance) under `Gemini Project` (`gen-lang-client-0217883943`) | **$0.00** |
| **Station Manager Studio** | [`promptfm.live/admin`](https://promptfm.live/admin) | On-air queue curation, community submission moderation, Discord/Telegram batch requests, manual DJ voice drops, channel management. Live on the Oracle OCI app path. | **$0.00** |
| **Icecast 2 Stream Admin** | [stream.promptfm.live:8000/admin](http://stream.promptfm.live:8000/admin/) | Direct Icecast mount points (`/stream.mp3`, `/cyberpunk.mp3`, `/chillout.mp3`, `/kids.mp3`, `/afterdark.mp3`), connected socket listeners, bitrate telemetry (served by the Oracle VM) | **$0.00** (Oracle Always Free) |
| **Oracle Cloud Instances** | [Compute instances](https://cloud.oracle.com/compute/instances?region=us-ashburn-1) | Always Free streamer VM (AMD micro today, Arm A1 when capacity returns): state, shape, public IP | **$0.00 (Always Free)** |
| **Oracle Metrics Explorer** | [Metrics Explorer](https://cloud.oracle.com/monitoring/metrics-explorer?region=us-ashburn-1) | Streamer CPU and memory (`oci_computeagent`) and outbound bytes (`oci_vcn` `VnicToNetworkBytes`) | **$0.00 (Always Free)** |
| **Oracle Cost Analysis** | [Cost Analysis](https://cloud.oracle.com/account-management/cost-analysis) | Confirms the Oracle bill stays at $0 | **$0.00 (Always Free)** |

### $0 guardrails on Oracle

| Layer | What it does | Stops spending? |
| :--- | :--- | :--- |
| **Quota policy** `promptfm-always-free-only` | Oracle refuses any compute except the free Arm allowance (2 OCPU / 12 GB) and any block storage past 200 GB, from the console or Terraform | **Yes** |
| **Terraform validations** | VM size locked to the free allowance, only the Arm A1 or AMD micro shape, plan fails outside the home region | Yes, before the API call |
| **$1 budget** | Emails when actual spend reaches $1 | No, alert only |
| **Outbound alarm** | Emails when the streamer sends more than 300 GB in a day (the free allowance is 10 TB/month). Created together with the VM | No, alert only |
| **Listener cap + bitrate ceiling** | Icecast refuses listener 231 on `/stream.mp3` (230 listeners x 128 kbps for a 31-day month is 9.9 TB of the 10 TB free). Nothing encodes above 128 kbps; spoken word is 64 kbps. About 240 full-time listeners fit. See [bitrate and capacity](docs/oracle-always-free-streamer.md#bitrate-and-listener-capacity) | **Yes** |
| **Network** | Only ports 22, 80 and 443 are open | n/a |

Confirm the Oracle notification email once, or the two alerts won't arrive. Details: [docs/oracle-always-free-streamer.md](docs/oracle-always-free-streamer.md).

### 🌐 Current public web state
- **`stream.promptfm.live`** is live on Oracle Cloud Always Free.
- **`promptfm.live` and `www.promptfm.live`** serve the live Next.js app from the repo-owned OCI path on the Oracle host.
- **Release, rollback, and forward redeploy are proven** on the OCI path via runs `42833955213`, `42858867447`, and `42862562417`.
- **Manual Vercel preview links still exist** for commit review, but they are no longer the documented production web release path in this branch.

---

## 🏗️ Architecture & Cloud Infrastructure

PromptFM combines the main Next.js app codebase with an autonomous Oracle Always Free streamer host and Supabase PostgreSQL backend. Public web and audio now run on Oracle Always Free: the stream directly on the host, and the web app through the repo-owned OCI release/cutover path. The stream moved from GCP (1 GB/month free outbound, too little for audio) to Oracle Cloud Always Free (about 10 TB/month outbound free) on 2026-11-09; the GCP VM is stopped ([details](docs/oracle-always-free-streamer.md)):

```
                                [Listener Web / iPhone PWA]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
                       ▼ HTTPS (Port 443)                          ▼ HTTPS
          ┌───────────────────────────┐               ┌───────────────────────────┐
          │   stream.promptfm.live    │               │ promptfm.live / www       │
          │ (Oracle Always Free)      │               │ (OCI web app)             │
          └─────────────┬─────────────┘               └─────────────┬─────────────┘
                        │                                           │
         ┌──────────────┴───────────────────────────────────────────┴──────────────┐
         │      Oracle VM: Caddy + Icecast + Liquidsoap + PromptFM web releases     │
         │                                                                          │
         │  - `stream.promptfm.live` -> Icecast / Liquidsoap                        │
         │  - `promptfm.live`, `www.promptfm.live` -> current OCI web release       │
         └──────────────────────────────────────┬───────────────────────────────────┘
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
- **Compute Engine:** Always-Free `e2-micro` instance (1 GB RAM, 30 GB standard persistent disk). It is retired and stopped (`streamer_vm_running = false`); [`infra/converge-stream.sh`](infra/converge-stream.sh) switches the stream between it and Oracle (see [docs/infra-overview.md](docs/infra-overview.md)).
- **Firewall Rules:** The public `80`/`443` rule was deleted; a disabled `allow-icecast` (`8000`) rule remains.
- **Telemetry Dashboard:** Provisions `google_monitoring_dashboard.telemetry_dashboard` from [`config/gcp-dashboard.json`](config/gcp-dashboard.json).

### 2. Oracle Cloud (`infra/terraform-oci/`)
- **Always Free VM** (Ubuntu 24.04) in `us-ashburn-1`, ports `22`/`80`/`443` only. Today an AMD micro (`VM.Standard.E2.1.Micro`, 1 GB RAM + 2 GB swap, audio only); Ampere A1 (2 OCPU / 12 GB) when Oracle has capacity. `stream.promptfm.live` is an `A` record to it.
- **$0 guards:** Terraform validations, a tenancy quota policy that blocks everything except Always Free, a $1 budget email, and an alarm at 300 GB/day outbound.
- **Credentials and state:** secret `promptfm-oci-credentials` in GCP Secret Manager; state in the same GCS bucket under `terraform/oci-state`.
- **Apply:** the **Apply Terraform (Oracle streamer)** workflow (plan-only unless `apply` is ticked), or `infra/terraform-oci/retry-apply.sh` when Oracle reports `Out of host capacity`. See [docs/oracle-always-free-streamer.md](docs/oracle-always-free-streamer.md).
- **Web deploy path in repo:** `.github/workflows/release.yml` and `.github/workflows/rollback.yml` both call `.github/workflows/deploy-web-oci.yml`, which builds the web image, deploys a candidate, gates on health/smoke checks, cuts over, and records retained-release metadata for rollback. Release/cutover, rollback, and forward redeploy are proven in runs `42833955213`, `42858867447`, and `42862562417`.

### 3. Ansible (`infra/ansible/`)
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
- The `ads.txt` route at [`https://promptfm.live/ads.txt`](https://promptfm.live/ads.txt) is generated by [`src/lib/ads/adsense.ts`](src/lib/ads/adsense.ts) (**90.48% Stryker score**) and is live on the Oracle OCI app path.
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

These public routes are part of the live OCI app path:
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

PromptFM supports native Discord Application Slash Commands and Button Interactions through a single serverless endpoint at `https://promptfm.live/api/bot/webhook` on the live OCI app path.

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
All community submissions via `/submit` are saved with `status: 'pending'`. They never enter the active radio airplay rotation until a station admin reviews the audio preview, ID3 metadata, embedded lyrics, and AI safety badges in the admin UI and clicks **Approve for Airplay**.

---

## 🤖 Model Context Protocol (MCP) & Community Bridges

PromptFM exposes a streamable **Model Context Protocol (MCP)** server at [`https://promptfm.live/api/mcp`](https://promptfm.live/api/mcp) on the live OCI app path.

- **Infrastructure overview (diagram, who does what, runbook, alert emails):** [`docs/infra-overview.md`](docs/infra-overview.md).
- **$0 Policy (Google Cloud, Oracle, GitHub Actions):** [`docs/zero-cost-policy.md`](docs/zero-cost-policy.md) (what stops spending, what only alerts, and what to do when an alert fires).
- **Listener Commands & Schedule Guide:** [`docs/listener-guide.md`](docs/listener-guide.md) (Discord & Telegram prompts, clock wheels, and queueing).
- **MCP Integration Guide:** [`docs/mcp-integration-guide.md`](docs/mcp-integration-guide.md) (Claude Desktop, Cursor, Antigravity, Windsurf).
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
- **Production Deployments:** Routine merges to `main` still run CI quality checks only. Manual Vercel preview links still exist for review. The repo-owned production web release and rollback path is OCI-based (`release.yml` / `deploy-web-oci.yml` / `rollback.yml`). Release/cutover, rollback, and forward redeploy are proven in runs `42833955213`, `42858867447`, and `42862562417`. Documentation updates still deploy via `gh-pages/<version>` to GitHub Pages.
- **Security & Secret Sharing:** Never post secrets or API keys in PRs or issues. For new environment variables, use ephemeral links ([Password Pusher](https://pwpush.com)) shared directly with @atrifan.

---

## 🩺 System Status & Health Telemetry

Current public status on the Oracle OCI production path:
- **Live public entrypoints:** [`https://promptfm.live`](https://promptfm.live) and [`https://www.promptfm.live`](https://www.promptfm.live) — live Next.js app via the Oracle OCI cutover path.
- **Live web health:** `/api/healthz` returns `{"status":"ok","ready":true,...}`; `/admin` and `/status` return HTTP 200 HTML; `/api/status` returns HTTP 200 JSON and keeps aggregate status tied to the public broadcast surface. Optional integrations such as Gemini and the Discord bridge can report `not_configured` until their runtime secrets are wired without flipping the public site to degraded.
- **Live audio stream:** [`https://stream.promptfm.live/stream.mp3`](https://stream.promptfm.live/stream.mp3).
- **Streamer health endpoint:** [`https://stream.promptfm.live/status-json.xsl`](https://stream.promptfm.live/status-json.xsl) remains HTTP 200. For operational truth, use the shared `infra/verify-stream-on-air.sh` check: fallback or standby markers in stream metadata are treated as failure when Oracle should be live.
- **Operator telemetry:** Oracle Metrics Explorer, GCP Cloud Logging, GCP Trace, and GitHub Actions checks linked above.

---

## 💰 Transparent Funding, Music Licensing & Multi-Rail Donations

PromptFM is an independent project. To maintain 100% legal compliance and operational transparency, all community contributions and sponsorships are directly budgeted:

| Allocation | Percentage | Purpose |
| :--- | :--- | :--- |
| **Radio & Music Royalties** | **35%** | Statutory licensing fees (ASCAP, BMI, SESAC, SoundExchange / StreamLicensing) to legally broadcast commercial licensed tracks alongside AI-generated music. |
| **Cloud & Audio Streaming** | **25%** | 24/7 continuous Icecast audio streaming, the Oracle-hosted public web app path, GCP-backed services, and audio object storage. |
| **Generative AI & Voice Compute** | **20%** | Gemini 1.5/2.0 API prompt tokens for real-time DJ banter scripting, weather/news synthesizers, and neural TTS voice generation credits. |
| **Engineering & Development** | **15%** | Dedicated development time maintaining audio pipelines, listener bots, Discord & Telegram bridges, and mobile apps. |
| **Maintainer Fuel (Coffee)** | **5%** | Espresso and coffee powering late-night bug triage, production monitoring, and community support. |

### Supported Donation Rails
- **Stripe Checkout:** Direct card, Apple Pay, and Google Pay support via [Stripe Donation](https://donate.stripe.com/6oUaEYdUpa9zgEA2H3cQU00).
- **PayPal.Me:** Direct 1-click tips via [paypal.me/promptfm](https://paypal.me/promptfm).
- **GitHub Sponsors:** 0% platform fee developer patronage at [github.com/sponsors/promptfm/signup](https://github.com/sponsors/promptfm/signup).
- **Ko-fi:** 1-click tips via Apple Pay, Google Pay, and PayPal at [ko-fi.com/promptfm](https://ko-fi.com/promptfm).
- **Bitcoin (BTC):** Direct on-chain contribution on Bitcoin Mainnet only to `bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9` ([View on Mempool](https://mempool.space/address/bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9)).
- **Ethereum / USDC:** Direct ERC-20 & ETH contribution on Ethereum Mainnet only to `0x9581F969727Ff987958d050C80662578C50F6A9f` ([View on Etherscan](https://etherscan.io/address/0x9581F969727Ff987958d050C80662578C50F6A9f)).

---

## 📡 $0-Cost Structured Logging & Distributed Tracing

PromptFM maximizes observability without incurring third-party SaaS fees (no Datadog or Splunk bills):
- **Google Cloud Logging (50 GB/month FREE):** Ingests single-line JSON logs emitted to stdout/stderr. Automatically indexes `severity`, `logging.googleapis.com/trace`, `httpRequest`, and `serviceContext` attributes.
- **W3C Distributed Tracing:** All incoming requests are assigned or inherit a 32-hex `traceId` and 16-hex `spanId` (via `traceparent`, `x-request-id`, or `x-cloud-trace-context`). Propagated across Next.js APIs, Icecast streamer, and AI generation calls for instant end-to-end trace correlation.
- **Isomorphic Logger:** Accessible via [`src/lib/telemetry/logger.ts`](src/lib/telemetry/logger.ts) supporting `logger.info()`, `logger.warn()`, `logger.error()`, and contextual child loggers `logger.child({ traceId, component })`.

---

## 🚀 Zero-Friction Release Automation & Tag-Based Deployment Gate

To eliminate release bottlenecks and protect our free-tier compute budget:
1. **Protected $0 Budget Policy:** Merges to `main` run CI verification (Vitest, Typecheck, Lint, Security) but do not auto-deploy the public site.
2. **Oracle-hosted Production Path:** The public entrypoint now runs through the OCI release/candidate/cutover workflow on the Oracle host, with the maintenance page kept as the failed-cutover fallback.
3. **End-to-End OCI Release, Rollback, and Forward Redeploy Are Proven:** `.github/workflows/release.yml` and `.github/workflows/rollback.yml` route the production web path through OCI candidate deploy, health/smoke gating, cutover, and retained-release rollback logic. Runs `42833955213`, `42858867447`, and `42862562417` provide the live proof.
4. **Documentation Releases:** Pushing a `gh-pages/<version>` tag (e.g. `gh-pages/v1.0.0`) deploys the documentation portal to GitHub Pages via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
5. **Automated Changelog:** GitHub Release notes are automatically generated from commit history with zero manual release drafting friction.
