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
| **Edit Track Metadata** | Library Tab ("Edit" button) | `admin edit <id> [options]` | `promptfm_admin_edit_track` |
| **Delete / Archive Track** | Library Tab ("Delete" button) | `admin delete <id> [--soft]` | `promptfm_admin_delete_track` |
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
| **Track Request Lifecycle Status** | Web Queue Card | `request <id\|query>` | `promptfm_get_request_status` |
| **List Content / Safety Reports** | Reports Tab | `report list` | `promptfm_admin_list_reports` |
| **Audit Content Reports** | Reports Tab ("Audit Reports Window") | `report audit [--limit N]` | `promptfm_admin_audit_reports` |
| **File Content Report** | Web 🚩 Report Modal | `report file <id> <reason>` | `promptfm_report_content` |
| **Resolve Report (Action/Dismiss)** | Click "Action" / "Dismiss" | `report resolve <id> --action <...> [--actor <...>]` | `promptfm_admin_resolve_report` |
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
| **Web MCP Studio & Interactive Tools** | Web MCP Studio Tab | `npm run promptfm` | Dual-Tier JSON-RPC (`/api/mcp`) |
| **Feature Flags & Traffic Exposure** | Vercel Dashboard / Flags Explorer | `vercel flags [list\|set\|rollout\|split]` | Vercel Flags SDK (`flags/next`) |
| **Emergency Kill-Switch Control** | Vercel Toolbar & Dashboard | `vercel flags set <key> false` | Vercel Flags SDK (`flags/next`) |

---

## 3. Admin Command Reference

### A. Terminal CLI (`npm run promptfm -- <command>`)

The PromptFM CLI is a standalone station management suite located in `scripts/promptfm.ts`.

#### 1. Content Reporting & Moderation
| Command | Description | Example |
| :--- | :--- | :--- |
| `report list` | Lists all pending community reports with targets, reasons, and reporter platforms. | `npm run promptfm -- report list` |
| `report audit [--limit N]` | Audits reports for status changes made during unauthenticated windows or lacking actor/timestamp attribution. | `npm run promptfm -- report audit --limit 50` |
| `report file <id> <reason> [details]` | Files a report directly from the terminal. | `npm run promptfm -- report file track-123 copyright_dmca "Sampled vocal"` |
| `report resolve <id> --action <actioned\|dismissed>` | Resolves a safety or copyright report, recording actor attribution, timestamp, and notes across database and memory cache. | `npm run promptfm -- report resolve rep_123 --action actioned --notes "Removed from rotation" --actor "compliance_alex"` |
| `admin list` | Lists all approved tracks in the station music library with ranks and votes. | `npm run promptfm -- admin list` |
| `admin edit <id> [options]` | Updates track metadata (title, artist, category, lyrics, explicit flags) and automatically re-indexes vector embeddings. | `npm run promptfm -- admin edit 0df3ba68-... --title "Cyber Dreams (Remix)" --category Electronic` |
| `admin delete <id> [--soft]` | Deletes a track from the library and cleans up any orphaned queue items. Performs hard deletion by default, or archival soft-delete with `--soft`. | `npm run promptfm -- admin delete 0df3ba68-... --soft` |
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
| `request <id or query>` | Inspects the end-to-end lifecycle status, queue position, ETA, and airplay state of a listener request (canonical: `accepted` → `queued` → `airing_soon` → `playing` → `played`/`rejected`). | `npm run promptfm -- request 186f9b8c` |
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

#### 7. Vercel Feature Flags, A/B Testing & Emergency Kill-Switches

Feature flags and progressive delivery in PromptFM are managed natively using **Vercel Flags** (`flags/next`), the **Vercel CLI** (`vercel flags`), and the **Vercel Dashboard / Vercel Toolbar**.

PromptFM exposes the official Vercel Flags Discovery Endpoint at `/.well-known/vercel/flags`, allowing the Vercel Toolbar and Vercel Flags Explorer to discover all registered station flags, inspect variants, configure percentage rollouts (traffic exposure), and trigger emergency kill-switches.

##### A. Managing Flags via Vercel CLI (`vercel flags`)

The Vercel CLI provides full terminal control over feature flags, progressive rollouts, and A/B test splits:

| Command | Description | Example |
| :--- | :--- | :--- |
| `vercel flags list` | Lists all feature flags, current variants, and targeting rules for the project. | `vercel flags list` |
| `vercel flags inspect <flag>` | Displays detailed configuration, rollout percentage, and audit history for a flag. | `vercel flags inspect community_requests` |
| `vercel flags set <flag> <value>` | Serves a specific boolean value or variant in production or preview environments. | `vercel flags set community_requests false` |
| `vercel flags rollout <flag>` | Configures progressive traffic exposure percentage (0% to 100%). | `vercel flags rollout new_player_ui --percentage 25` |
| `vercel flags split <flag>` | Configures weighted variant splits for A/B testing across listeners. | `vercel flags split modern_visualizer` |
| `vercel flags open [flag]` | Opens the Vercel Dashboard directly to the project's feature flags console. | `vercel flags open maintenance_mode` |

##### B. Managing Flags via Vercel Dashboard & Vercel Toolbar

1. **Vercel Toolbar & Flags Explorer (Preview & Production)**:
   - On any preview deployment or production site, open the **Vercel Toolbar** (bottom-right icon).
   - Click the **Flags** icon to open the **Flags Explorer**.
   - View all registered PromptFM flags with their descriptions and default states.
   - Instantly override flag values for testing without redeploying.

2. **Environment & Security Configuration**:
   - `FLAGS_SECRET`: A 32-byte secret configured in Vercel Project Settings $\to$ Environment Variables. Secures the `/.well-known/vercel/flags` endpoint so only authorized Vercel tools and dashboard extensions can inspect definitions and generate overrides.
   - Local/CI Overrides: In local development, developers can override any flag instantly using environment variables:
     - `PROMPTFM_FLAG_COMMUNITY_REQUESTS=false`
     - `FLAG_MAINTENANCE_MODE=true`

##### C. Emergency Kill-Switch Runbook for On-Call Engineers

When incidents, upstream rate limits, or degradation occur, on-call engineers can halt station subsystems immediately:

1. **Emergency Maintenance Mode**:
   ```bash
   vercel flags set maintenance_mode true
   ```
   *Puts the station in maintenance mode and halts non-essential listener pipelines.*

2. **Pause Listener Song Requests (`community_requests`)**:
   ```bash
   vercel flags set community_requests false
   ```
   *Disables `/song` queueing across Discord, Telegram, and Web without taking down the station stream.*

3. **Halt AI Speech Synthesis (`ai_dj_speech`)**:
   ```bash
   vercel flags set ai_dj_speech false
   ```
   *Switches the station to pure music-only rotation if TTS or LLM APIs experience rate limits.*

4. **Emergency Audio Output Mute (`live_audio_stream`)**:
   ```bash
   vercel flags set live_audio_stream false
   ```
   *Instantly pauses client-side audio player playback during catastrophic audio or licensing emergencies.*

---

### B. Web Studio Admin Console (`/admin`)

Access the visual web console at `https://promptfm.vercel.app/admin` (or `http://localhost:3000/admin` locally). Requires signing in with an authorized email configured in `NEXT_PUBLIC_ADMIN_EMAILS`.

1. **Submissions Tab**:
   - Preview tracks with an inline 30-second audio player.
   - Inspect AI tool metadata (Suno, Udio, Stable Audio).
   - Click **Approve** (green check) or **Reject** (red cross).
2. **Library Tab**:
   - View, search, and manage all approved station tracks.
   - **Edit Metadata Modal**: Update title, artist, category, description, lyrics, explicit flag, BPM, and trigger automatic pgvector re-indexing.
   - **Delete Track**: Soft-delete (archival) or hard-delete with automatic removal of orphaned queue entries.
   - Queue any track directly to the live broadcast with one click (+).
3. **Live Queue Tab**:
   - Live view of upcoming scheduled items in real time.
   - Remove songs or re-order airplay.
4. **Batches Tab**:
   - Live view of listener requests scheduled into 30-minute clock batches.
   - Click **Air Now** to immediately synthesize and play the request drop.
   - Click **Reject / Remove from Batch** with custom rejection reason (e.g. *Religious hostility*, *18+ Adult theme outside watershed*). Automatically dispatches a refusal notification back to the user on Telegram or Discord!
5. **Reports Tab**:
   - Displays all filed community reports with target ID, reason code, details, reporter handle, and timestamp.
   - Actions: **"Dismiss"** or **"Take Action"** (marks ticket resolved across system).
6. **Upload MP3 Tab**:
   - Upload MP3 files directly from your computer to Cloudflare R2.
   - Bypasses moderation and immediately adds the track to the station rotation.
7. **Channels & Guardrails Tab**:
   - View all live radio channels, assigned DJs, and statutory guardrails.
   - Create new channels with automated 18+ COPPA/statutory age gate banners and policies.
8. **Web MCP Studio Tab**:
   - Interactive admin console to directly execute Model Context Protocol (MCP) actions within the web browser.
   - Quick-action generators for AI Voice Drops, Interstitials, Sponsor Ads, Dedicated Air Requests, Station Broadcasts, and Channel provisioning.
   - Interactive JSON-RPC raw tool caller with parameter inspector and formatted live response output.

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
| `promptfm_admin_list_reports` | Retrieves active community moderation tickets. | `limit?` |
| `promptfm_admin_audit_reports` | Audits moderation reports for unattributed changes or tampering from unauthenticated windows. | `limit?` |
| `promptfm_admin_resolve_report` | Resolves or dismisses a report ticket with actor & notes attribution. | `report_id`, `action` ("actioned" \| "dismissed"), `notes?`, `actor?` |
| `promptfm_admin_list_channels` | Lists broadcast channels and guardrails. | None |
| `promptfm_admin_create_channel` | Creates a new broadcast channel with guardrails. | `slug`, `name`, `is_18_plus?` |
| `promptfm_admin_broadcast` | Dispatches announcements to Discord and Telegram. | `message`, `category?`, `title?` |
| `promptfm_admin_air_request` | Forces immediate synthesis and airplay for a dedication. | `request_id` |
| `promptfm_admin_inject_interstitial` | Injects an on-air voice drop or weather update. | `type`, `prompt?`, `city?` |
| `promptfm_admin_inject_ad` | Injects a sponsor commercial or ad read. | `sponsor?`, `copy?` |
| `promptfm_admin_edit_track` | Edits track metadata and reindexes embeddings in pgvector. | `track_id`, `title?`, `artist?`, `category?`, `description?`, `lyrics?`, `is_explicit?`, `ai_tool?`, `bpm?`, `genre?`, `reindex_vector?` |
| `promptfm_admin_delete_track` | Deletes or archives a track and purges orphaned queue items. | `track_id`, `soft_delete?` |

---

### D. REST API Endpoints

#### Public Endpoints
- `GET /api/radio/now`: Returns current on-air track, upcoming items, active DJ, and listener count.
- `POST /api/report`: Ingests community content reports from Web/Bots.
- `POST /api/bot/webhook`: Handles inbound Telegram bot webhooks and slash commands.
- `POST /api/mcp`: Dual-tier Model Context Protocol JSON-RPC 2.0 handler.
- `POST /api/scan-lyrics`: Gemini 3.5 Flash automated safety and lyrical profanity scanner.

#### Station Administration Endpoints (`ADMIN_API_KEY` Required)
All `/api/admin/*` endpoints require authentication when `ADMIN_API_KEY` is configured via `Authorization: Bearer <ADMIN_API_KEY>`, `x-admin-key: <ADMIN_API_KEY>`, or query parameter `?key=<ADMIN_API_KEY>`:

- `GET /api/admin/reports`: Lists recent content moderation reports (supports `?limit=N`, default 30; supports `?audit=true` for audit summary).
- `GET /api/admin/reports/audit`: Returns security and moderation audit summary, detecting status changes made during unauthenticated windows.
- `POST /api/admin/reports`: Actions or dismisses a moderation report (`{ reportId, action: 'actioned' | 'dismissed', notes?, actor? }`).
- `GET /api/admin/requests`: Lists pending and scheduled listener requests from Discord/Telegram.
- `POST /api/admin/requests`: Approves, airs, or rejects listener requests with reason tracking.
- `GET /api/admin/stream`: Returns real-time RTMP stream status across YouTube and TikTok.
- `POST /api/admin/stream`: Starts or stops RTMP video broadcast streams to external platforms.
- `POST /api/admin/broadcast`: Dispatches synchronized announcements across Discord, Telegram, and X.

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
   - `:00` — **Community Headliners & Vault Rotation**: Featured community AI music productions headlining the hour from across the approved library.
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
| **GitHub Sponsors** | Developer Patronage | Monthly / One-time (0% platform fee) | `https://github.com/sponsors/promptfm/signup` |
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

---

## 7. $0 Infrastructure Budget Policy & Free-Tier Guardrails (Vercel & CI)

PromptFM is architected to operate **permanently within the $0/month free-tier budget** across all cloud providers (GCP Always Free `e2-micro`, Vercel Hobby, Cloudflare R2, and Supabase Free Tier). To prevent sudden cost spikes or exceeding Vercel's included **4 hours/month of Fluid Active CPU**, strict operational guardrails are enforced across deployment previews and CI pipelines.

### A. Core Budget Metrics & Limits

| Service / Resource | Included Free Tier | Warning Threshold | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Vercel Fluid Active CPU** | 4.0 hours / month | 75% (3.0 hours) | Ignored build script, Edge CDN caching, background tab polling suspension |
| **Vercel Previews** | Unlimited builds | Gated & Protected | Cancel on bot/doc PRs, require maintainer authorization for forked PRs |
| **GitHub Actions CI** | 2,000 mins / month | Concurrency cancel | Concurrency group per PR, path scope detection, Playwright browser caching |
| **GCP Compute VM** | 1 `e2-micro` (Always Free) | 1 VM in `us-central1` | Terraform IaC state locking, 128 kbps audio stream |
| **Cloudflare R2 Egress** | Unlimited free egress | Free tier bandwidth | Public audio distribution via custom domain |

### B. Vercel Preview Deployment Protection & Gating

1. **Ignored Build Step (`scripts/vercel-budget-gate.sh`)**:
   Configured in `vercel.json` via `"ignoreCommand": "bash scripts/vercel-budget-gate.sh"`.
   - **Production deployments are gated to release tags** (`promptfm/<version>` or `v*.*.*`). Routine merges to `main` are cancelled (exit code 0) to protect Vercel Fluid Active CPU budget.
   - **Manual override**: Production deployments can be forced on `main` via `ENABLE_MAIN_PRODUCTION_DEPLOYS=true` or by tagging commit messages with `[deploy-prod]` or `[release]`.
   - **Documentation releases** (`gh-pages/<version>`) deploy strictly to GitHub Pages, bypassing Vercel entirely.
   - **Automated bot branches** (`dependabot/*`, `renovate/*`) are automatically cancelled (exit code 0).
   - **Forked pull requests** require explicit maintainer authorization before building previews.
   - **Non-application changes** (pure documentation, markdown, infra, or CI workflows) skip preview builds.
   - **Explicit Opt-in**: Contributors can trigger a preview build by including `[preview]`, `[deploy-preview]`, or `[run-preview]` in their commit message.
   - **Explicit Skip**: Authors can skip preview builds by adding `[skip preview]`, `[skip vercel]`, or `[skip ci]`.

2. **Search Engine & Crawler Blocking on Previews**:
   Non-production deployments (`VERCEL_ENV=preview`) automatically serve a restrictive `robots.txt` (`disallow: ['/']`) via `generateRobotsConfig()` to prevent web crawlers and SEO bots from hammering preview endpoints and burning Active CPU.

3. **Edge CDN Caching for High-Frequency Radio Routes**:
   - `/api/radio/now`: `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`
   - `/api/radio/schedule`: `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`
   - `/api/status`: `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`
   Within edge cache windows, identical requests across all listeners and components are served instantly from Vercel's global Edge Network with **0ms active CPU consumption**.

4. **Page Visibility Lifecycle Optimization**:
   Frontend components (`AudioPlayer`, `UpNextSection`, `ScheduleView`, and `LiveListenersBadge`) automatically detect when a browser tab is minimized or inactive (`document.hidden`). Polling loops are suspended until the tab returns to `visible` state, slashing background compute usage.

### C. GitHub Actions CI Trimming

- **Scope Change Detection (`detect-changes`)**: Checks the diff on every pull request. PRs altering only markdown, documentation, or legal terms bypass expensive test suites.
- **Playwright Browser & Build Caching**: Caches `~/.cache/ms-playwright` and `.next/cache`. Skips re-running `npx playwright install --with-deps` on cache hits and builds Next.js incrementally.
- **Targeted Mutation Testing**: Stryker mutation testing is capped at a 20-minute timeout and only triggers when core domain logic in `src/lib/` or tests change. Bypassed entirely on automated Dependabot PRs.
- **Conditional Terraform & CodeQL**: Terraform linter/validator only triggers when `infra/` changes. CodeQL security scanning is bypassed on automated dependency bumps.

### D. 4-Way Operational Control Reference

#### 1. Terminal CLI (`npm run promptfm -- budget`)
```bash
# View active $0 budget policy, Vercel CPU limits & CI trimming status
npm run promptfm -- budget policy

# Test/evaluate Vercel preview build gate decision for a simulated PR or ref
npm run promptfm -- budget gate --env preview --branch dependabot/npm/foo
npm run promptfm -- budget gate --env preview --branch feature/stream-ui --message "feat: ui [preview]"

# Evaluate which CI jobs will execute for a given PR actor and changed file set
npm run promptfm -- budget ci --actor dependabot[bot] --files "package.json,package-lock.json"
npm run promptfm -- budget ci --actor contributor --files "src/components/AudioPlayer.tsx"
```

#### 2. Model Context Protocol (MCP Tool: `promptfm_admin_get_infra_budget`)
Query the $0 budget status programmatically from any MCP-enabled client:
```json
{
  "name": "promptfm_admin_get_infra_budget",
  "arguments": {}
}
```
**Example Response**:
```json
{
  "success": true,
  "policy": {
    "monthlyCostTargetUsd": 0,
    "vercelActiveCpuWarningThresholdPercent": 75,
    "vercelMaxActiveCpuHoursHobby": 4,
    "forkPreviewsRequireApproval": true,
    "autoPreviewsEnabledByDefault": false,
    "protectedPreviewAccess": true
  },
  "budget_status": "operational_zero_cost",
  "note": "PromptFM $0 infra path: Vercel previews gated, crawlers blocked on preview, CI trimmed."
}
```

#### 3. Web Studio Console (`/admin`)
- Vercel dashboard metrics can be reviewed at [vercel.com/alextrifan/promptfm/usage](https://vercel.com/alextrifan/promptfm/usage).
- Vercel Speed Insights and Real User Monitoring (RUM) Core Web Vitals can be monitored at [vercel.com/alextrifan/promptfm/speed-insights](https://vercel.com/alextrifan/promptfm/speed-insights).
- Deployment protection can be toggled under **Project Settings ➔ Deployment Protection** in the Vercel console.

#### 4. REST API & Dynamic Headers
- Inspect `Cache-Control` response headers on `/api/radio/now` and `/api/radio/schedule` using `curl -I https://promptfm.live/api/radio/now`.
- Verify preview crawler blocking on preview deployments via `curl https://<preview-domain>/robots.txt`.


### E. Tag-Based Release Operations Runbook (Issue #123)

To ensure PromptFM stays strictly within its $0 infrastructure footprint and avoids Vercel Fluid Active CPU quota exhaustion, the core team operates under a tag-based release standard.

#### 1. App Production Release Workflow
Production builds deploy exclusively to the `production` GitHub environment (`https://promptfm.live`) upon pushing an application release tag:
- **Supported Tag Patterns**: `promptfm/<version>` (e.g., `promptfm/v1.0.0` or `promptfm/0.1.0`) and semver `v*.*.*` (e.g., `v1.0.0`).
- **Release Steps**:
  ```bash
  # 1. Ensure main branch is checked out and up to date
  git checkout main
  git pull origin main

  # 2. Tag the commit
  git tag promptfm/v1.0.0

  # 3. Push the tag to trigger .github/workflows/release.yml
  git push origin promptfm/v1.0.0
  ```
- **Automated Quality Gate**: `.github/workflows/release.yml` executes:
  1. `npm test` (unit and integration tests)
  2. `npm run typecheck` (strict TypeScript validation)
  3. Registers deployment in GitHub `production` environment
  4. Triggers Vercel Production Build (via deploy hook or tag integration)
  5. Probes live endpoint `https://promptfm.live/api/status`
  6. Stamps deployment status with a verified active checkmark

#### 2. Documentation Portal Release Workflow
Documentation updates deploy to GitHub Pages under the `github-pages` environment upon pushing a doc release tag:
- **Supported Tag Pattern**: `gh-pages/<version>` (e.g., `gh-pages/v1.0.0`).
- **Release Steps**:
  ```bash
  git tag gh-pages/v1.0.0
  git push origin gh-pages/v1.0.0
  ```
- **Automated Workflow**: `.github/workflows/pages.yml` packages `docs/` and deploys to the `github-pages` environment without triggering Vercel builds or consuming Active CPU.

#### 3. Emergency Deployments on `main`
Routine merges to `main` are automatically skipped by `scripts/vercel-budget-gate.js` (`exitCode: 0`). If an emergency production deploy directly from `main` is required without creating a tag:
- **Option A (Commit Message Tag)**: Include `[deploy-prod]` or `[release]` in the commit message:
  ```bash
  git commit -m "hotfix: critical security patch [deploy-prod]"
  ```
- **Option B (Vercel Environment Override)**: Set `ENABLE_MAIN_PRODUCTION_DEPLOYS=true` in Vercel Project Environment Variables.

#### 4. Runtime CPU Guardrails & Telemetry Architecture
To prevent duplicate execution under live listener load:
- **Single Now-Playing Calculation**: `/api/radio/now` resolves `getNowPlaying()` once and passes it directly to `getUpNext(channelSlug, 3, status)`, stopping duplicate Icecast probes and Supabase rank queries.
- **Client-Side Telemetry Multiplexer (`src/lib/radio/telemetry-client.ts`)**: Coalesces concurrent in-flight requests and caches telemetry for 8 seconds. Dispatches `promptfm:radio-telemetry` CustomEvents so `AudioPlayer`, `UpNextSection`, and `LiveListenersBadge` share a single network stream rather than maintaining separate polling loops.

#### 5. Vercel Deploy Hook & Webhook Infrastructure

To connect GitHub Actions release tag events with Vercel without requiring full personal access tokens in CI, PromptFM uses a dedicated **Vercel Deploy Hook**:

- **Purpose**: Enables `.github/workflows/release.yml` to trigger an authenticated production build on `main` when a valid release tag (`promptfm/*` or `v*.*.*`) is pushed.
- **Configuration Details**:
  - **Project**: `alextrifan/promptfm` (`prj_n4NJ1yquHGMywU4WBacPbHoLKphL`)
  - **Hook Name**: `promptfm-release`
  - **Target Branch**: `main`
  - **Deploy Hook ID**: `Jyx6wAqnF9`
  - **Secret Location**: Stored as GitHub Actions repository secret `VERCEL_DEPLOY_HOOK`
  - **Webhook URL**: `https://api.vercel.com/v1/integrations/deploy/prj_n4NJ1yquHGMywU4WBacPbHoLKphL/Jyx6wAqnF9`

##### Managing Deploy Hooks via Vercel CLI
```bash
# 1. List configured deploy hooks
vercel deploy-hooks ls

# 2. Create a new deploy hook targeting main
vercel deploy-hooks create promptfm-release --ref main

# 3. Manually trigger a deployment via curl
curl -X POST "$VERCEL_DEPLOY_HOOK"

# 4. Remove a deploy hook by ID
vercel deploy-hooks rm Jyx6wAqnF9
```

##### Managing Deploy Hooks via Vercel Web Dashboard
1. Open [vercel.com/alextrifan/promptfm/settings/git](https://vercel.com/alextrifan/promptfm/settings/git).
2. Scroll to the **Deploy Hooks** section.
3. View, edit, or copy the hook URL.

##### Rotating the Deploy Hook Secret
If the hook URL is ever rotated:
```bash
# Update the GitHub Actions secret directly via gh CLI:
echo "<NEW_DEPLOY_HOOK_URL>" | gh secret set VERCEL_DEPLOY_HOOK
```

#### 6. Vercel Ignore Hook (`ignoreCommand` Pre-Build Budget Gate)

Configured in `vercel.json` via `"ignoreCommand": "bash scripts/vercel-budget-gate.sh"`.

- **How It Works**:
  1. Vercel spins up a lightweight sandboxed runner before installing npm packages or invoking `next build`.
  2. The gate evaluates the git environment (`VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, commit message, and tags pointing at HEAD via `git tag --points-at`).
  3. **Exit Code 0 (CANCEL/SKIP)**: Build is aborted immediately in 2–3s. Consumes **0 Fluid Active CPU minutes**.
     - Applied to: routine merges to `main`, preview PRs from unapproved forks, and non-application doc updates.
  4. **Exit Code 1 (PROCEED)**: Build continues through dependency install and Next.js compilation.
     - Applied to: tags matching `promptfm/*` or `v*.*.*`, explicit `[deploy-prod]` commit markers, or maintainer approved previews `[preview]`.

##### Verifying Ignore Hook Decisions Locally
```bash
# Simulate a routine merge to main (should exit 0 / skip):
VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main node scripts/vercel-budget-gate.js
# Output: [PromptFM Budget Gate] 🛑 Skipped: Production auto-deploy from main disabled... (exit 0)

# Simulate a release tag (should exit 1 / proceed):
VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=promptfm/v1.0.0 node scripts/vercel-budget-gate.js
# Output: [PromptFM Budget Gate] ✅ Proceeding: Tagged production release permitted... (exit 1)
```

---

## 15. GitHub Actions Workflows & Deployment Architecture

PromptFM leverages automated GitHub Actions workflows to govern releases, Vercel deployments, Terraform cloud infrastructure, and secret management under the strict $0 Always-Free Tier policy.

### A. Workflows Directory & Triggers

| Workflow | File | Trigger | Purpose |
| :--- | :--- | :--- | :--- |
| **🚀 Release PromptFM** | `.github/workflows/release-promptfm.yml` | `workflow_dispatch` or push tag `promptfm/*` | Cuts release tag `promptfm/<version>-<short_hash>`, verifies quality gate, deploys to Vercel Production, and creates GitHub Release. |
| **🏗️ Apply Terraform Changes** | `.github/workflows/apply-terraform.yml` | `workflow_dispatch` or push to `main` (`infra/terraform/**`, `infra/ansible/**`) | Runs `npm run prepare-infra`, initializes free GCS state backend, and applies Terraform infrastructure changes. |
| **🔍 Create Preview Link in Vercel** | `.github/workflows/create-preview-link.yml` | `workflow_dispatch` (`commit_sha`) | On-demand Vercel preview deployment for a specific commit SHA without auto-triggering on PR approval. |
| **🔐 Update Secrets in Vercel** | `.github/workflows/update-secrets.yml` | `workflow_dispatch` (`secret_key`, `secret_value`, `environments`) | Securely writes environment variables to Vercel with SecretShare runbook integration. |
| **⏪ Rollback PromptFM** | `.github/workflows/rollback.yml` | `workflow_dispatch` (`rollback_ref`) | Rolls back production to a specified commit SHA or Tag, generating `promptfm/rollback-<sha>` or `promptfm/rollback-<version>`. |
| **📚 Release GitHub Pages** | `.github/workflows/pages.yml` | `workflow_dispatch` or push to `main` (`docs/**`) | Deploys documentation and architectural guides to GitHub Pages. |
| **💬 PR Quality Gate & Bot** | `.github/workflows/ci.yml` (`pr-guidance-comment`) | `pull_request` (when quality checks pass) | Comments instructions: *"make an admin run the Make preview link workflow on the following sha: `<sha>`"* and posts action cards for Terraform/Ansible updates. |

---

### B. Free Terraform State Architecture: Why NOT in Git?

> [!CAUTION]
> **Do NOT store Terraform state (`terraform.tfstate`) in Git repositories.**
> 1. **Secret Leakage**: Terraform state files store sensitive resources (passwords, private keys, API tokens) in unencrypted plain text.
> 2. **Race Conditions & Corruption**: Git lacks distributed write-locking. Concurrent updates will corrupt the state file and cause divergent cloud reality.

#### Recommended Free Remote State Backend: Google Cloud Storage (GCS)
The PromptFM repository is pre-configured with a remote GCS backend in [`infra/terraform/versions.tf`](file:///Users/trifan/.gemini/antigravity/worktrees/promptfm/github_workflows_vercel_deploy/infra/terraform/versions.tf):
```hcl
terraform {
  backend "gcs" {
    bucket = "promptfm-tfstate-promptfm-radio-1793623670"
    prefix = "terraform/state"
  }
}
```
- **Why GCS is 100% Free**: Google Cloud provides **5 GB of Standard storage per month** in `us-central1`, `us-west1`, and `us-east1` completely free under the GCP Always-Free Tier. A Terraform state file is ~50 KB, consuming less than 0.001% of the free quota.
- **Distributed State Locking**: GCS automatically supports atomic state locking via Google Cloud generation numbers, preventing concurrent modification without any additional cost.

---

### C. Required Repository Secrets & Vercel Configuration

To enable these workflows, configure the following secrets in GitHub (**Settings ➔ Secrets and variables ➔ Actions**):

| Secret Name | Required By | Description / Source |
| :--- | :--- | :--- |
| `VERCEL_TOKEN` | Release, Preview, Rollback, Secrets | Personal or Team Access Token from [vercel.com/account/tokens](https://vercel.com/account/tokens). |
| `VERCEL_ORG_ID` | Vercel CLI Operations | Organization / Account ID from Project Settings ➔ General. |
| `VERCEL_PROJECT_ID` | Vercel CLI Operations | Project ID from Project Settings ➔ General. |
| `GCP_SA_KEY` | Terraform & Infra Prep | Base64-encoded Service Account JSON key with Compute Admin & Storage Object Admin permissions. |
| `HOSTINGER_API_TOKEN` | Terraform DNS Sync | API token from Hostinger Console (for managing `@` and subdomain DNS records). |
| `GH_PAT` | Tagging & PR Bot | GitHub Personal Access Token (or repo token from `git remote -v`) with `repo` and `workflow` scopes. |

#### Vercel Project Settings to Verify:
1. **Ignored Build Step**:
   - Set **Command** to: `bash scripts/vercel-budget-gate.sh`
   - This ensures automatic PR preview builds are skipped unless explicitly tagged with `[preview]`, saving Active CPU hours.
2. **Deploy Hook (Optional)**:
   - Create a deploy hook under **Settings ➔ Git ➔ Deploy Hooks** and save it as `VERCEL_DEPLOY_HOOK` in GitHub repository secrets if hook-based triggers are preferred.

---

## 11. GitHub Community Standards & Content Reports Configuration

GitHub tracks community health metrics at [`https://github.com/PromptFM/promptfm/community`](https://github.com/PromptFM/promptfm/community). PromptFM maintains a 100% compliant community profile adhering to all recommended standards:

### A. Community Governance Files
1. **Code of Conduct:** [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — Contributor Covenant v2.1 with enforcement by Board Admin (**@atrifan** / `conduct@promptfm.live`).
2. **Security Policy:** [`SECURITY.md`](../SECURITY.md) — Responsible disclosure policy, private security advisory link, SLA response matrix, and safe harbor.
3. **Accessibility Commitment:** [`ACCESSIBILITY.md`](../ACCESSIBILITY.md) — WCAG 2.1 AA conformance, keyboard shortcuts (`Space`, `M`, `1-5`), and screen reader `aria-live` specifications.
4. **Contribution Guide:** [`CONTRIBUTING.md`](../CONTRIBUTING.md) — TDD requirements, local zero-cost simulation, and PR lifecycle.
5. **Issue & PR Templates:** [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/) and [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md).

### B. Enabling "Repository Admins Accept Content Reports"

GitHub allows repository maintainers to receive content reports from community members on issues, PRs, comments, and discussions. This feature is enabled via the GitHub Web UI (as GitHub provides no programmatic REST API for this setting):

1. Navigate to the repository settings:
   `https://github.com/PromptFM/promptfm/settings`
2. In the left navigation menu under the **Access** header, click **Moderation options**, then select **Reported content**.
3. Under **Reported content**:
   - Set **Who can report content** to **Prior contributors and collaborators** or **All users** (recommended for public community projects).
4. Click **Save**.
5. Once saved, visiting the **Community Standards** checklist will show a green checkmark for **Repository admins accept content reports**, and the community profile API (`/repos/PromptFM/promptfm/community/profile`) will return `"content_reports_enabled": true`.

### C. Triaging Content Reports in GitHub
When a user flags a comment or issue:
- Station administrators receive an in-app and email notification.
- Navigate to **Settings ➔ Moderation options ➔ Reported content** to view pending reports.
- Available actions:
  - **Dismiss report**: Mark as reviewed if no violation occurred.
  - **Hide comment**: Hide the offending content with reason (Abuse, Off-topic, Spam).
  - **Block user**: Apply temporary or permanent interaction limits in accordance with [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md).

---

## 17. PostgreSQL & Supabase Database Schema Management

PromptFM uses PostgreSQL hosted on Supabase (`oxfacfdpxbxilucooijy.supabase.co`). All database schema changes and migrations are tracked as code under `supabase/migrations/` and automated through GitHub Actions.

### A. Architectural Choice: TypeScript Migrator vs. Ansible

- **Why Not Ansible for Database Schema?**
  Ansible is specifically designed for server/VM configuration (e.g. provisioning the GCP Compute Engine streamer VM running Icecast / Liquidsoap). Supabase is a cloud-managed DBaaS. Running Ansible to execute SQL migrations would require Python `psycopg2` packages, local host inventory, and extra runtime overhead without native type safety.
- **Why TypeScript Migrator with Vercel Secret Resolution?**
  - **Single Source of Truth**: Production database credentials (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`) are stored in Vercel. In GitHub Actions, `npx vercel env pull .env.production.local --environment=production --yes` pulls live credentials seamlessly.
  - **Native Node 22 Stack**: Runs directly via `jiti` with `pg` and `@supabase/supabase-js`, with 0 additional system dependencies.
  - **Idempotency & Auditing**: Schema migrations are tracked in `public.schema_migrations` with SHA256 checksums and UTC timestamps.
  - **Red-Green-Refactor Tested**: Full unit test and Stryker mutation coverage.

---

### B. SQL Schema Linter & Quality Gate

Every Pull Request that alters `.sql` or `supabase/` files triggers automated SQL linting in CI:
- **Syntax Validation**: Ensures balanced parentheses `()`, balanced quotes `''`, and dollar quote tags (`$$...$$`).
- **Idempotent DDL**: Enforces `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DROP TABLE IF EXISTS` for repeatable deployments.
- **Safety Enforcement**: Prohibits dangerous destructive operations like naked `DROP DATABASE`.
- **Supabase Row Level Security (RLS)**: Enforces `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on public tables.

---

### C. 4-Way Operational Control Reference

#### 1. Terminal CLI
```bash
# Lint all repository SQL files
npm run lint:sql

# Check only files changed relative to main branch
npx jiti scripts/lint-sql.ts --changed

# Preview pending database migrations without modifying database (Dry Run)
npm run db:migrate -- --dry-run

# Execute pending schema migrations against live database
npm run db:migrate
```

#### 2. GitHub Actions Workflow (UI & Web)
- **Workflow:** `🐘 Apply SQL Schema Migrations` (`.github/workflows/apply-sql-schema.yml`)
- **Triggers:**
  - **Automatic**: Merges to `main` touching `supabase/**`, `src/lib/sql/**`, or `scripts/apply-sql-migrations.ts`.
  - **Manual**: Via **Actions ➔ Apply SQL Schema Migrations ➔ Run workflow** (with optional `dry_run` toggle).

#### 3. PR Guidance Bot Card
When a pull request includes SQL migrations, the automated PR guidance bot adds:
```markdown
> [!IMPORTANT]
> **SQL Schema Update Required:** After merge have an admin run the [Update SQL Schema workflow](https://github.com/PromptFM/promptfm/actions/workflows/apply-sql-schema.yml)
```

#### 4. REST / Secret Sync
Pull production Supabase secrets from Vercel:
```bash
npx vercel env pull .env.production.local --environment=production --yes
```

---

## 18. Secret Management & Secure Handoff Runbook

PromptFM maintains a strict zero-leakage security posture. Production credentials, API tokens, and private keys must never appear in Git history, pull requests, issues, or code review comments.

### A. The 3 Golden Rules of Secret Sharing

1. **NEVER post secrets in GitHub**:
   - Do not paste API tokens, database connection strings, or service account keys into pull request descriptions, issues, commits, or comments.
   - Gitleaks CI scanning (`.github/workflows/ci.yml`) will fail and block PR merge if raw secrets are detected.
2. **Use Ephemeral Encrypted Links for Handoff**:
   - If a new feature or infrastructure component requires a new production secret (e.g. Resend API Key, Supabase Service Role Key, Gemini API Key):
   - Generate an encrypted, self-destructing link using **[Password Pusher](https://pwpush.com)** (configured for 1 view or 24-hour expiration) or **[OneTimeSecret](https://onetimesecret.com)**.
   - Send the secret link directly to **`dev@promptfm.live`** or via private maintainer DM to Board Admin (**@atrifan**).
3. **Explicitly Document Secret Requirements in PRs**:
   - Under the **Environment Variables & Secrets Required** section in the PR template, list the *names* of the environment variables (e.g., `RESEND_API_KEY`) and state the handoff method used:
     ```markdown
     ### Environment Variables & Secrets Required
     - `RESEND_API_KEY`: Sent via Password Pusher link to dev@promptfm.live
     ```
   - If no new secrets are needed, write:
     ```markdown
     ### Environment Variables & Secrets Required
     None
     ```

---

### B. Admin Runbook: Injecting Secrets into Vercel & Cloud

Once a secret is received from a contributor:

#### 1. Method A: GitHub Actions Workflow (`update-secrets.yml`)
1. Go to **Actions ➔ 🔐 Update Secrets in Vercel**.
2. Click **Run workflow**:
   - **Secret Key Name**: Enter key (e.g. `RESEND_API_KEY`).
   - **Secret Value**: Paste secret value (automatically masked in logs).
   - **Target Environments**: Select `production,preview,development`.
3. Click **Run workflow**. The workflow syncs the secret to Vercel via API.

#### 2. Method B: Vercel CLI (Local Admin Terminal)
```bash
# Add secret to production
npx vercel env add RESEND_API_KEY production

# Add secret to preview environments
npx vercel env add RESEND_API_KEY preview

# Pull updated secrets into local development sandbox
npx vercel env pull .env.local --environment=development --yes
```

---

### C. Automated PR Checks for Secrets & UI Changes

The automated PR Guidance Bot detects and responds to changed files with dedicated guidance cards:
- **Missing Secret Notes**: If `.env.example`, `*.tfvars`, or `secrets-sync.ts` is changed without secret handoff notes in the PR description, the bot posts:
  > `### ⚠️ PR Review Check: Environment & Secret Handoff Required`
- **Secrets Update Card**: Directs admins to the `update-secrets.yml` workflow:
  > `> **Secrets Update Required:** If new production secrets or credentials are required, have an admin run the Update Secrets workflow: https://github.com/PromptFM/promptfm/actions/workflows/update-secrets.yml`
- **UI Changes Card**: When frontend files (`src/app/**`, `src/components/**`, `public/**`) are modified, the bot posts:
  > `> **UI Preview Required:** Visual or component changes detected. To spin up a live preview URL on Vercel, have a core team member comment /pr-link on this PR or ask an admin to run the Create Preview Link workflow for sha <sha>.`







