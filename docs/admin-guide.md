# PromptFM Station Admin & Content Reporting Manual

This document explains **how content reporting works from end-to-end** and provides the complete command reference for PromptFM Program Directors and Station Administrators.

---

## 1. How Content Reporting Works (End-to-End Lifecycle)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. LISTENER / AGENT INGEST                      │
│                                                                        │
│  • Web UI: Click 🚩 on any chart track or live bottom player bar       │
│  • Telegram: Tap "🚩 Report" inline button or type /report <id> <msg>  │
│  • Discord: Click "🚩 Report" button or type /report target: reason:   │
│  • MCP: AI agents call promptfm_report_content tool                    │
│  • CLI: npm run promptfm -- report file <id> <reason> [details]        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. INGESTION & VALIDATION                       │
│                                                                        │
│  Endpoint: POST /api/report (or direct bot webhook / MCP handler)      │
│  Validates category:                                                   │
│    - copyright_dmca     (Unlicensed vocals, stems, or melody rips)     │
│    - hate_harassment    (Slurs, attacks, targeted harassment)          │
│    - religious_ethical  (Religious mockery, defamation of faiths)      │
│    - unlabeled_18_plus  (Adult / explicit themes aired outside 22-06)  │
│    - spam_abuse         (Flooding, deceptive metadata)                 │
│    - other              (General guidelines violation)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3. STORAGE & LOGGING                            │
│                                                                        │
│  • Writes to Supabase table: public.content_reports                    │
│  • Disk Cache: /tmp/promptfm_reports.json (for offline resilience)     │
│  • Generates unique ticket ID: rep_<timestamp>_<random>                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  4. REAL-TIME ADMIN ALERT BROADCAST                    │
│                                                                        │
│  Automatically fires an urgent moderation alert embed to connected     │
│  Discord and Telegram station staff channels:                          │
│                                                                        │
│  🚨 PROMPTFM CONTENT REPORT FILED                                      │
│  • Target: track (track-uuid-1234)                                     │
│  • Reason: DMCA & Copyright Infringement                               │
│  • Platform: TELEGRAM                                                  │
│  • Reporter: @listener_handle (ID: 987654)                             │
│  • Details: "Unlicensed sample from copyrighted song"                  │
│  • Ticket ID: rep_1793639704_k2it4                                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  5. ADMIN AUDIT & RESOLUTION ACTIONS                   │
│                                                                        │
│  Admins can review, inspect, and take action through:                  │
│  A. Web Studio (/admin -> "Reports" tab): 1-click Take Action / Dismiss│
│  B. CLI: npm run promptfm -- report list / admin reject <id>           │
│  C. MCP: promptfm_admin_list_reports / promptfm_admin_moderate_track   │
│  D. API: POST /api/admin/reports { reportId, action: 'actioned' }      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete 3-Way Admin Feature Parity Matrix

Every administrative capability is designed with **100% feature parity** across the visual **Web Studio (`/admin`)**, the **Terminal CLI (`npm run promptfm`)**, and the **Model Context Protocol (MCP)** endpoint:

| Capability | Web Studio (`/admin`) | Terminal CLI (`npm run promptfm`) | MCP Admin Tool (`/api/mcp`) |
| :--- | :---: | :---: | :---: |
| **Inspect Station Music Library** | Library Tab | `admin list` | `promptfm_get_top_tracks` |
| **Queue Track on Air from Library** | Click "Queue on Air" (+) | `queue <title/prompt>` | `promptfm_queue_song_request` |
| **Review Pending Submissions** | Submissions Tab | `admin pending` | `promptfm_admin_list_pending` |
| **Approve Community Track** | Click "Approve" (✓) | `admin approve <trackId>` | `promptfm_admin_moderate_track` (`action: 'approved'`) |
| **Reject Community Track** | Click "Reject" (✗) | `admin reject <trackId>` | `promptfm_admin_moderate_track` (`action: 'rejected'`) |
| **Audio Preview / Stream** | In-browser audio player | `listen` (mpv/ffplay) | Track `audio_url` in response |
| **Inspect Live "Up Next" Queue** | Live Queue Tab | `q` / `queue list` | `promptfm_get_up_next` (includes scheduled batch requests) |
| **Remove Item from Queue** | Trash icon on queue item | `queue remove <queueId>` | `promptfm_admin_remove_from_queue` |
| **Bump Track to Front of Queue** | N/A | `queue next <trackId>` | `promptfm_admin_inject_interstitial` |
| **List Community Batches/Requests** | Batches Tab | `requests list` | `promptfm_admin_list_requests` |
| **Synthesize & Air Batch Request** | Click "Air Now" | `requests air <requestId>` | `promptfm_admin_air_request` |
| **Reject Request with Feedback** | Click "Reject & Notify" | `requests reject <id> --reason "..."` | `promptfm_admin_reject_request` |
| **List Content / Safety Reports** | Reports Tab | `report list` | `promptfm_admin_list_reports` |
| **File Content Report** | Web 🚩 Report Modal | `report file <id> <reason>` | `promptfm_report_content` |
| **Resolve Report (Action/Dismiss)** | Click "Action" / "Dismiss" | `report resolve <id> --action <...>` | `promptfm_admin_resolve_report` |
| **Direct MP3 Station Upload** | Upload Tab (R2 Presigned) | `upload <file.mp3> --title "..."` | Upload API (`/api/upload-url`) |
| **pgvector Semantic RAG Search** | N/A | `vibe <prompt>` | `promptfm_search_tracks_by_vibe` |
| **Semantic Request Queueing** | Queue Tab | `queue <prompt>` | `promptfm_queue_song_request` |
| **Automatic Embedding Indexing**| On Upload / Approval | On `upload` / `admin approve` | `promptfm_admin_moderate_track` |
| **Force-Inject News/Weather/Drops** | N/A | `inject <type> <prompt>` | `promptfm_admin_inject_interstitial` |
| **Inject Sponsor / Ad Spot** | N/A | `ads inject [adId]` | `promptfm_admin_inject_ad` |
| **Broadcast to Discord & Telegram** | N/A | `broadcast "<message>"` | `promptfm_admin_broadcast` |
| **Inspect & Update Schedule** | N/A | `schedule` | `promptfm_admin_update_schedule` |
| **Bot Setup & Health Check** | N/A | `bot telegram setup` / `bot discord test` | Built-in Bot Registration Suite |
| **Check Live Stream Status** | Live Streams Tab | `stream status` | `promptfm_admin_get_stream_status` |
| **Start YouTube Live Broadcast** | Click "Start YouTube Live" | `stream start youtube <key>` | `promptfm_admin_start_stream` (`platform: 'youtube'`) |
| **Start TikTok Live Broadcast** | Click "Start TikTok Live" | `stream start tiktok <key> [url]` | `promptfm_admin_start_stream` (`platform: 'tiktok'`) |
| **Stop Live Video Broadcast** | Click "Stop Stream" | `stream stop <platform>` | `promptfm_admin_stop_stream` |

---

## 3. Admin Command Reference

### A. Terminal CLI (`npm run promptfm -- <command>`)

The PromptFM CLI is a standalone station management suite located in `scripts/promptfm.ts`.

#### 1. Content Reporting & Moderation
| Command | Description | Example |
| :--- | :--- | :--- |
| `report list` | Lists all pending community reports with targets, reasons, and reporter platforms. | `npm run promptfm -- report list` |
| `report file <id> <reason> [details]` | Files a report directly from the terminal. | `npm run promptfm -- report file track-123 copyright_dmca "Sampled vocal"` |
| `report resolve <id> --action <actioned\|dismissed>` | Resolves a safety or copyright report, updating status across database and memory cache. | `npm run promptfm -- report resolve rep_123 --action actioned --notes "Removed from rotation"` |
| `admin list` | Lists all approved tracks in the station music library with ranks and votes. | `npm run promptfm -- admin list` |
| `admin pending` | Lists all community track submissions awaiting review. | `npm run promptfm -- admin pending` |
| `admin approve <trackId>` | Approves a track to air on the live stream and leaderboard. | `npm run promptfm -- admin approve 0df3ba68-...` |
| `admin reject <trackId>` | Rejects an inappropriate track and removes it from airplay. | `npm run promptfm -- admin reject 0df3ba68-...` |
| `dmca quarantine <trackId> [reason]` | Executes an immediate statutory takedown killswitch, removing the track from rotation, leaderboard, and stream. | `npm run promptfm -- dmca quarantine trk_123 "Statutory 17 U.S.C. 512 notice"` |

#### 2. Community Batches & Request Moderation
| Command | Description | Example |
| :--- | :--- | :--- |
| `requests list` | Lists upcoming scheduled community requests (songs, dedications, weather, zodiac). | `npm run promptfm -- requests list` |
| `requests air <requestId>` | Synthesizes an individual dedication drop. | `npm run promptfm -- requests air req-101` |
| `requests air-batch <batchId>` | **Consolidated Batch Airing**: Synthesizes ALL collected dedications, weather requests, and shoutouts in a batch into **ONE single broadcast announcement** by the active AI DJ. | `npm run promptfm -- requests air-batch BATCH-18:45` |
| `requests reject <id> --reason "<reason>"` | Removes a request from a batch, logs the rejection reason, and notifies the user on Discord/Telegram. | `npm run promptfm -- requests reject req-99 --reason "Religious mockery violates broadcast ethics"` |

#### 3. Airplay Queue Management ("Up Next")
| Command | Description | Example |
| :--- | :--- | :--- |
| `queue list` | Shows the active upcoming airplay rotation for the main channel. | `npm run promptfm -- queue list` |
| `queue next <trackId>` | Force-injects a track to play **NEXT** on air. | `npm run promptfm -- queue next 0df3ba68-...` |
| `queue remove <queueId>` | Drops an item from the upcoming queue. | `npm run promptfm -- queue remove 1234` |
| `now` | Displays currently playing track, active AI DJ on air, and elapsed time. | `npm run promptfm -- now` |
| `next` | Lists the next 5 items queued for broadcast. | `npm run promptfm -- next` |

#### 4. Live Drops, Sponsor Ads & Audio Synthesis
| Command | Description | Example |
| :--- | :--- | :--- |
| `upload <file> [options]` | **Unified Track Upload Tool**: Uploads an MP3/M4A/WAV file directly to Supabase Storage CDN (or R2), extracts ID3 metadata & embedded album art, extracts lyrics, sets votes/genre, and indexes 768-dim embeddings. All scratch upload scripts are replaced by this single command. | `npm run promptfm -- upload track.mp3 --title "Title" --artist "Artist" --category "Synthwave & Electro" --votes 32` |
| `say "<text>" [--dj <id>]` | Synthesizes a manual AI DJ voice drop with Gemini 2.5 TTS on demand. | `npm run promptfm -- say "Welcome listeners to PromptFM"` |
| `weather [city] [--dj <id>]` | Fetches live Open-Meteo weather and synthesizes an on-air forecast on demand. | `npm run promptfm -- weather Tokyo --dj luna` |
| `news [topic] [--live]` | Synthesizes an on-demand AI news drop from real Google RSS headlines. | `npm run promptfm -- news tech --live` |
| `dj "<prompt>"` | Generates a custom banter or announcement drop with the active on-air DJ. | `npm run promptfm -- dj "Welcome night owls to PromptFM"` |
| `ads list` | Lists all configured sponsor spots and audio types. | `npm run promptfm -- ads list` |
| `ads inject <adId|copy>` | Injects a sponsor ad read or pre-recorded spot to air NEXT. | `npm run promptfm -- ads inject suno_promo` |
| `broadcast "<message>"` | Pushes an announcement embed to connected Discord & Telegram channels. | `npm run promptfm -- broadcast "Special weekend countdown begins!"` |
| `schedule` | Displays the active YAML broadcast schedule, rotation blocks, and pure-music clock wheels. | `npm run promptfm -- schedule` |
| `listen` | Streams PromptFM live audio in your terminal using `mpv` or `ffplay`. | `npm run promptfm -- listen` |

#### 5. Channels & Statutory Guardrails
| Command | Description | Example |
| :--- | :--- | :--- |
| `channels list` | Lists all broadcast channels, active DJs, 18+ mode, and guardrails. | `npm run promptfm -- channels list` |
| `channels create <slug> <name> [--18plus]` | Creates a new channel with automated statutory disclaimers & age gates. | `npm run promptfm -- channels create afterdark "PromptFM After Dark" --18plus` |
| `vibe <prompt>` | Performs pgvector semantic similarity search across track catalog. | `npm run promptfm -- vibe "dark industrial metal"` |
| `queue <prompt>` | Finds track matching prompt vibe and queues it for airplay. | `npm run promptfm -- queue "cyberpunk synthwave with heavy bass"` |

#### 6. Bot Registration & Community Integrations
| Command | Description | Example |
| :--- | :--- | :--- |
| `bot telegram setup [token]` | Registers webhook (`https://promptfm.live/api/bot/webhook`) and official 9-command autocomplete menu with Telegram Bot API. | `npm run promptfm -- bot telegram setup 123456:ABC-DEF` |
| `bot telegram shorthands [token]` | Registers all 18 commands (canonical + shorthands `/np`, `/q`, `/n`, `/s`, `/d`, `/w`, `/z`, `/r`, `/h`) in Telegram popup menu. | `npm run promptfm -- bot telegram shorthands` |
| `bot telegram commands [token] [--shorthands]` | Refreshes Telegram native autocomplete popup menu (optionally with `--shorthands`). | `npm run promptfm -- bot telegram commands --shorthands` |
| `bot telegram status [token]` | Checks Telegram webhook status, pending update count, and last delivery errors. | `npm run promptfm -- bot telegram status` |
| `bot telegram test [token] [chatId]` | Dispatches an on-air verification test message to the Telegram channel or group. | `npm run promptfm -- bot telegram test 123456:ABC -100987654` |
| `bot telegram post-guide [token] [chatId]` | Broadcasts the pinned-ready Listener Command & Airplay Schedule Guide to Telegram. | `npm run promptfm -- bot telegram post-guide 123456:ABC -100987654` |
| `bot discord setup [appId] [botToken]` | Registers application slash commands and shorthands directly with Discord REST API. | `npm run promptfm -- bot discord setup 123456789 bot-secret-token` |
| `bot discord test [webhookUrl]` | Dispatches an on-air rich embed test card to the Discord channel webhook. | `npm run promptfm -- bot discord test https://discord.com/api/webhooks/...` |
| `bot discord post-guide [webhookUrl]` | Broadcasts the Listener Command & Airplay Schedule Guide embed to Discord. | `npm run promptfm -- bot discord post-guide https://discord.com/api/webhooks/...` |

---

### B. Web Studio Admin Console (`/admin`)

Access the visual web console at `https://promptfm.vercel.app/admin` (or `http://localhost:3000/admin` locally). Requires signing in with an authorized email configured in `NEXT_PUBLIC_ADMIN_EMAILS`.

1. **Submissions Tab**:
   - Preview tracks with an inline 30-second audio player.
   - Inspect AI tool metadata (Suno, Udio, Stable Audio).
   - Click **Approve** (green check) or **Reject** (red cross).
2. **Live Queue Tab**:
   - Live view of upcoming scheduled items in real time.
   - Remove songs or re-order airplay.
3. **Batches Tab**:
   - Live view of listener requests scheduled into 30-minute clock batches.
   - Click **Air Now** to immediately synthesize and play the request drop.
   - Click **Reject / Remove from Batch** with custom rejection reason (e.g. *Religious hostility*, *18+ Adult theme outside watershed*). Automatically dispatches a refusal notification back to the user on Telegram or Discord!
4. **Reports Tab**:
   - Displays all filed community reports with target ID, reason code, details, reporter handle, and timestamp.
   - Actions: **"Dismiss"** or **"Take Action"** (marks ticket resolved across system).
5. **Upload MP3 Tab**:
   - Upload MP3 files directly from your computer to Cloudflare R2.
   - Bypasses moderation and immediately adds the track to the station rotation.
6. **Channels & Guardrails Tab**:
   - View all live radio channels, assigned DJs, and statutory guardrails.
   - Create new channels with automated 18+ COPPA/statutory age gate banners and policies.

---

### C. MCP (Model Context Protocol) Admin Tools (`/api/mcp`)

AI agents can manage the station autonomously by connecting to the MCP endpoint with the admin header `Authorization: Bearer <ADMIN_API_KEY>` or `?key=<ADMIN_API_KEY>`:

| MCP Tool Name | Description | Required Arguments |
| :--- | :--- | :--- |
| `promptfm_search_tracks_by_vibe` | Performs pgvector semantic similarity search. | `prompt`, `limit?`, `channel_id?` |
| `promptfm_queue_song_request` | Queues a song request for airplay via semantic search. | `prompt`, `requester?`, `channel_id?` |
| `promptfm_report_content` | Files a content report against a track or dedication. | `target_id`, `reason`, `details?`, `platform?` |
| `promptfm_admin_list_pending` | Returns all pending submissions awaiting review. | None |
| `promptfm_admin_moderate_track` | Approves or rejects a track from airplay. | `track_id`, `action` ("approved" \| "rejected") |
| `promptfm_admin_list_reports` | Retrieves active community moderation tickets. | None |
| `promptfm_admin_resolve_report` | Resolves or dismisses a report ticket. | `report_id`, `action` ("actioned" \| "dismissed") |
| `promptfm_admin_list_channels` | Lists broadcast channels and guardrails. | None |
| `promptfm_admin_create_channel` | Creates a new broadcast channel with guardrails. | `slug`, `name`, `is_18_plus?` |
| `promptfm_admin_broadcast` | Dispatches announcements to Discord and Telegram. | `message`, `category?`, `title?` |
| `promptfm_admin_air_request` | Forces immediate synthesis and airplay for a dedication. | `request_id` |
| `promptfm_admin_inject_interstitial` | Injects an on-air voice drop or weather update. | `type`, `prompt?`, `city?` |
| `promptfm_admin_inject_ad` | Injects a sponsor commercial or ad read. | `sponsor?`, `copy?` |

---

### D. REST API Endpoints

- `GET /api/radio/now`: Returns current on-air track, upcoming items, active DJ, and listener count.
- `POST /api/report`: Ingests community content reports from Web/Bots.
- `POST /api/bot/webhook`: Handles inbound Telegram bot webhooks and slash commands.
- `POST /api/mcp`: Dual-tier Model Context Protocol JSON-RPC 2.0 handler.
- `POST /api/scan-lyrics`: Gemini 3.5 Flash automated safety and lyrical profanity scanner.

---

## 4. Schedule-Driven Architecture & Pure Music Configuration

PromptFM's airplay engine is strictly **schedule-driven**:

1. **Schedule-Driven Interstitial Execution in `src/lib/dj/rotation.ts`**:
   - The rotation engine retains full built-in support for automated top-of-the-hour news broadcasts (`fetchLiveHeadlines` + Gemini TTS), regional weather checks (`fetchLiveWeatherSummary` + Gemini TTS), sponsor ad reads, and DJ persona banter.
   - Rather than hardcoding these drops, the rotation engine dynamically inspects the active show's `clock_milestones` in `src/lib/radio/schedule.ts`.
   - Because the schedule is currently configured with **100% pure music milestones**, the rotation engine plays music uninterrupted, completely eliminating Gemini Free Tier API requests and preventing HTTP 429 `RESOURCE_EXHAUSTED` errors.
   - When station directors wish to re-enable news, weather, or banter in the future, simply declaring those milestones in `schedule.ts` or `schedule.yaml` will activate them in the rotation engine automatically without any engine code modifications.

2. **Community Request Batching & Consolidated Single Announcements**:
   - To prevent ruining the music flow and avoid burning Gemini API rate limits, listener requests arriving from Telegram or Discord (`/dedicate`, `/weather`, `/zodiac`) are **never played immediately between every song**.
   - Requests are automatically organized into 15-minute broadcast batch slots (`calculateNextBatchSlot`).
   - Announcements only air when specifically scheduled or approved.
   - When aired, `synthesizeBatchAnnouncement(batchId)` aggregates **all** collected listener shoutouts and weather queries in that batch into **ONE single consolidated radio announcement** (under 45 words), consuming only **1 single Gemini API call** for the whole batch.

3. **Hourly Musical Clock Milestones (Current Schedule)**:
   Each hour of programming is structured around 4 music milestones:
   - `:00` — **Hourly Community Top 40 Countdown**: The highest-voted community tracks headlining the hour.
   - `:15` — **Deep Cut & Indie AI Showcase**: Hidden gems and undiscovered AI music productions.
   - `:30` — **Mid-Hour Rhythm & Vibe Transition**: Seamless tempo shifts and fresh instrumental beats.
   - `:45` — **Listener Requested Airplay Block**: Community queue requests and listener picks streamed back-to-back.

3. **Unified CLI Track Upload Reference**:
   All previous one-off upload scripts have been permanently removed in favor of the unified CLI:
   ```bash
   # Upload any track directly into rotation:
   npm run promptfm -- upload /path/to/song.mp3 \
     --title "Track Name" \
     --artist "Artist Name" \
     --category "Synthwave & Electro" \
     --votes 32

   # All options supported:
   #   -t, --title <title>          Track title (auto-detected from ID3 if omitted)
   #   -a, --artist <artist>        Artist name
   #   -c, --category <cat>         Genre/Category (e.g. "Chillout & Ambient", "Kids & Family")
   #   -v, --votes <count>          Initial leaderboard upvotes
   #   -d, --description <desc>     Track prompt or backstory
   #   -m, --model <tool>           AI generator model (Suno, Udio, Stable Audio)
   #   --explicit                   Flag track as 18+ explicit
   #   --family-friendly            Flag track as safe for Kids & Family channel
   #   --embed                      Generate 768-dim pgvector embedding for semantic search
   ```

---

## 5. Community Funding, Budget Transparency & Multi-Rail Donations

PromptFM maintains an open-ledger, transparent funding model where 100% of listener donations, sponsorships, and advertising revenues are reinvested directly into station operations, legal compliance, and software engineering.

### A. 5-Pillar Budget Allocation

```
┌────────────────────────────────────────────────────────────────────────┐
│               PROMPTFM TRANSPARENT BUDGET ALLOCATION                   │
│                                                                        │
│  [██████████████]  35% Commercial Radio Music Licensing (ASCAP/BMI)   │
│  [██████████]      25% Streaming Servers & Bandwidth (Icecast/R2/GCP) │
│  [████████]        20% Generative AI & Voice Credits (Gemini/TTS)      │
│  [██████]          15% Continuous Engineering & Development Time       │
│  [██]               5% Maintainer Fuel & Coffee                        │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Commercial Radio Music Licensing (35%)**: Statutory performance royalties (ASCAP, BMI, SESAC, SoundExchange) to legally stream commercial songs and licensed prompts alongside AI music.
2. **Streaming & Cloud Infrastructure (25%)**: 24/7 Icecast streamer VM, MinIO/R2 audio storage, edge CDN bandwidth, and serverless compute.
3. **Generative AI & Voice Credits (20%)**: Google Gemini 1.5/2.0 API prompt tokens and neural TTS voice synthesis for AI DJ banter.
4. **Continuous Engineering & Development (15%)**: Platform engineering, radio bot maintenance, DSP audio processing, and web development.
5. **Maintainer Fuel / Coffee (5%)**: Community operations and maintainer sustenance.

### B. Supported Contribution Rails

| Rail | Type | Supported Methods | Destination / URL |
| :--- | :--- | :--- | :--- |
| **Stripe Checkout** | Card / Digital Wallets | Visa, MC, Amex, Apple Pay, Google Pay, Link | `https://donate.stripe.com/6oUaEYdUpa9zgEA2H3cQU00` |
| **PayPal.Me** | Balance / Bank / Card | PayPal account, debit/credit | `https://paypal.me/promptfm` |
| **Ko-fi** | Tip Jar / Subscriptions | Apple Pay, Google Pay, Card, PayPal | `https://ko-fi.com/promptfm` |
| **GitHub Sponsors** | Developer Patronage | Monthly / One-time (0% platform fee) | `https://github.com/sponsors/PromptFM` |
| **Bitcoin (BTC)** | Direct On-Chain | Bitcoin Mainnet Only | `bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9` |
| **Ethereum (ETH / USDC)** | Direct On-Chain | Ethereum Mainnet Only (ERC-20) | `0x9581F969727Ff987958d050C80662578C50F6A9f` |

### C. Surface Points in Codebase
- **Web UI**: Landing page `#funding` component (`src/components/FundingSection.tsx`), Navigation menu (`src/components/Navbar.tsx`), Footer links (`src/components/Footer.tsx`), and Public status page (`src/app/status/page.tsx`).
- **Telemetry API**: `GET /api/status` returns complete allocation JSON.
- **Helper Library**: `src/lib/community/funding.ts` defines `getFundingBreakdown()`, `getCryptoDonationWallets()`, `getStripeDonationConfig()`, `getDonationOptions()`, and `getFundingMissionStatement()`.

---

## 6. Live RTMP Video Streaming Control (YouTube & TikTok)

PromptFM can re-encode its 24/7 uninterrupted Icecast stream into high-definition live video feeds with visualizer artwork and stream them to **YouTube Live** (16:9 landscape) and **TikTok Live** (9:16 portrait) with zero cloud egress cost.

### A. Streaming Architecture

```
                               ┌────────────────────────────────────────────────────────┐
                               │             GCP ALWAYS-FREE STREAMER VM                │
                               │                                                        │
[Supabase Catalog] ───────────►│  [Liquidsoap 2.2.5] ──► [Icecast 2: /stream.mp3]       │
                               │                                │                       │
                               │                                ▼ (Local Ingest)        │
                               │  ┌──────────────────────────────────────────────────┐  │
                               │  │   FFmpeg RTMP Sidecar & Stream Controller (3001) │  │
                               │  │   • Video: H.264 (1280x720 / 720x1280 @ 30fps)   │  │
                               │  │   • Audio: AAC 192kbps / 44.1kHz                  │  │
                               │  │   • Overlays: Album cover art + logo loops       │  │
                               │  └───────────────┬──────────────────────┬───────────┘  │
                               └──────────────────┼──────────────────────┼──────────────┘
                                                  │                      │
                                                  ▼ RTMP                 ▼ RTMP
                                       ┌──────────────────────┐┌──────────────────────┐
                                       │     YouTube Live     ││     TikTok Live      │
                                       │ 16:9 Landscape Video ││ 9:16 Portrait Video  │
                                       └──────────────────────┘└──────────────────────┘
```

### B. 4-Way Control Reference

#### 1. Web Studio Console (`/admin` -> "Live Streams" tab)
- **Status Dashboard**: Live status indicator (🟢 LIVE / ⚪ OFFLINE) with started timestamp and process PID.
- **YouTube Live**:
  - Enter Stream Key (persistent key from YouTube Studio).
  - Click **Start YouTube Live Stream** to trigger FFmpeg broadcast.
  - Click **Stop YouTube Live Stream** to terminate cleanly.
- **TikTok Live**:
  - Enter Server URL (session RTMP ingest endpoint from TikTok Live Center).
  - Enter Stream Key (session-based key).
  - Click **Start TikTok Live Stream** / **Stop TikTok Live Stream**.

#### 2. Terminal CLI (`npm run promptfm`)
```bash
# Check status of all live RTMP broadcasts
npm run promptfm -- stream status

# Start YouTube Live broadcast with your stream key
npm run promptfm -- stream start youtube xxxx-xxxx-xxxx-xxxx-xxxx

# Start TikTok Live broadcast with session key and ingest URL
npm run promptfm -- stream start tiktok <SESSION_KEY> rtmp://push-rtmp-f.tiktok.com/app

# Stop live broadcasts
npm run promptfm -- stream stop youtube
npm run promptfm -- stream stop tiktok
```

#### 3. Model Context Protocol (MCP Tools)
- **`promptfm_admin_start_stream`**: Starts YouTube or TikTok stream.
  ```json
  {
    "platform": "youtube",
    "stream_key": "xxxx-xxxx-xxxx-xxxx-xxxx"
  }
  ```
- **`promptfm_admin_stop_stream`**: Stops stream.
  ```json
  {
    "platform": "youtube"
  }
  ```
- **`promptfm_admin_get_stream_status`**: Queries real-time streaming state.
  ```json
  {}
  ```

#### 4. REST API (`/api/admin/stream`)
- **GET `/api/admin/stream`** (requires `x-admin-key` header): Returns JSON status of active sessions.
- **POST `/api/admin/stream`**:
  ```json
  {
    "action": "start",
    "platform": "youtube",
    "streamKey": "xxxx-xxxx-xxxx-xxxx-xxxx"
  }
  ```


