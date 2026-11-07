# PromptFM Engineering Roadmap & Feature Checklist

This document tracks upcoming features, architectural milestones, and infrastructure enhancements for PromptFM. Items are checked off as they are developed and verified through our Test-Driven Development (TDD) workflow.

---

## 🎯 Active Milestones & Backlog

### 1. 24/7 Continuous Audio Stream Server (GCP Free Tier)
- [x] **GCP Always Free `e2-micro` VM Setup**: Provisioned a free-tier Compute Engine instance (`us-central1-a`, 1 GB RAM, 30 GB PD) running Docker.
- [x] **Icecast 2 / Liquidsoap Continuous Broadcaster**: Configured Liquidsoap dynamic track fetcher that queries PromptFM's Next.js API, decodes finite MP3s, crossfades, and streams continuous 128 kbps MP3 to Icecast.
- [x] **Dynamic Stream Feeder Endpoint (`/api/radio/next?format=uri`)**: Implemented raw URI output verified via Vitest integration tests (100% pass rate).
- [x] **Terraform & Ansible Infrastructure Code**: Complete IaC suite with GCS Always Free remote state backend and 1-click Makefile state machine.
- [ ] **SSL/HTTPS Termination for Audio Stream**: Expose stream over HTTPS (e.g. via Hostinger domain `stream.promptfm.live` or Cloudflare Tunnel) to avoid browser mixed-content blocks and GCP egress bandwidth fees.
- [ ] **AudioPlayer Live Stream Sync**: Connect web frontend [`AudioPlayer.tsx`](src/components/AudioPlayer.tsx) to the live continuous mount with seamless fallback.

---

### 2. Autonomous 24/7 Playback & Clock Daemon
- [x] **Now-Playing Drift & Queue ETA Precision**: Fixed station state synchronization when a track finishes, eliminated stale airplay drift, and added deterministic queue ETA calculation with queue position and requester attribution.
- [ ] **Background Rotation Worker**: Implement an automated clock daemon (Node.js/TypeScript or lightweight container) that calculates track durations, rotates active DJs by schedule, and updates the `now_playing` status continuously.
- [ ] **Auto-Trigger Interstitial Drops**: Automatically trigger news bulletins, weather reports, and sponsor reads at scheduled clock wheel minutes (`:00`, `:20`, `:40`).
- [ ] **Automated Discord & Telegram Airplay Dispatch**: Push "Now Playing" and spoken transcript embeds upon each automated track transition.

---

### 3. Mobile Player Ergonomics (<375px Viewports)
- [ ] **Ultra-Compact Mobile Bottom Bar**: Redesign sticky audio player for small phone screens (iPhone SE / Android sub-375px).
- [ ] **Slide-Up Controls Drawer**: Move volume slider, transcript viewer toggle, and report flag into an expandable modal drawer on mobile viewports.
- [ ] **Truncated Title/Artist Marquee**: Ensure long track titles and AI model tags never overflow or push UI buttons off-screen.

---

### 4. Discord Bot Slash Commands & Interactive Gateway
- [ ] **Discord Interactions Endpoint / Gateway Client**: Add ed25519 signature verification to [`/api/bot/webhook`](src/app/api/bot/webhook/route.ts) or deploy a dedicated `discord.js` gateway bot.
- [ ] **Native Slash Commands**: Implement `/song`, `/dedicate`, `/weather`, `/zodiac`, `/nowplaying`, `/vote`, and `/report` directly within Discord chat.
- [ ] **Interactive Discord Components**: Real-time upvote and report buttons directly on Discord track embeds.

---

### 5. Automated Audio Vocal ASR Guardrail
- [ ] **Whisper / Gemini Audio Scanner**: Automatically transcribe audio vocals of user-submitted MP3s before approval.
- [ ] **Hidden Lyrics Safety Filter**: Inspect transcribed vocal lyrics against hate speech, harassment, and 18+ explicit rules to catch violations missed by metadata.
- [ ] **Automated Flagging**: Auto-quarantine submissions whose transcribed audio violates broadcast standards.

---

### 6. Autonomous Generative Music Pipeline
- [ ] **Suno / Udio / Stable Audio Generator Worker**: Bridge listener chat prompts (e.g. `/song "cyberpunk ambient"`) to an automated music synthesis pipeline.
- [ ] **Auto-Ingestion to Airplay Queue**: Automatically normalize, tag, and insert generated songs into upcoming broadcast batches.

---

### 7. Realtime WebSockets for Admin Studio
- [ ] **Supabase Realtime Subscriptions**: Wire live WebSocket channels to [`/admin`](src/app/admin/page.tsx) so moderation tickets, listener requests, and vote counts update instantly without page reloads.
- [ ] **Audio Scrubbing / Waveform Preview**: Add visual waveform seeking for admin review of submissions.

---

### 8. Vercel Flags SDK & Emergency Kill-Switch Architecture (#48)
- [x] **Native Vercel Flags SDK (`flags/next`)**: Dynamic discovery endpoint at `/.well-known/vercel/flags` with secure access proof verification.
- [x] **Percentage Rollouts & A/B Testing**: Deterministic 32-bit FNV-1a hashing for gradual traffic exposure and weighted variant splits.
- [x] **Subsystem Kill Switches**: Emergency runtime toggles for `community_requests`, `community_voting`, `voice_drops`, `maintenance_mode`, and channel broadcasts without code deployment.
- [x] **Vercel CLI & Dashboard Runbook**: Documented operational workflows using `vercel flags` commands and the Vercel Toolbar in `docs/admin-guide.md`.

---

### 9. Web MCP Actions Console & Admin Track Management (#72, #35, #36)
- [x] **Interactive Web MCP Console**: In-browser client executing public and admin Model Context Protocol actions directly from the station UI without CLI/curl requirements.
- [x] **Admin Track Curation & Soft Deletion**: Full administrative track editing, metadata updating, soft deletion with airplay protection, and audit logging.

---

### 10. $0 Infrastructure Budget Guardrails & Free-Tier Optimization (Issue #108)
- [x] **Vercel Preview Gate & Ignored Build Step**: Configured `ignoreCommand` via `scripts/vercel-budget-gate.sh` to enforce $0 budget policy by skipping preview builds on automated bot branches and doc/infra PRs.
- [x] **Forked PR Authorization & Bot Prevention**: Gated preview deployments from forked pull requests until maintainer-approved; automatically skipped Dependabot and Renovate PRs to conserve Vercel Active CPU.
- [x] **Edge CDN Caching for High-Frequency Routes**: Added `s-maxage` headers (`s-maxage=5` on `/api/radio/now`, `s-maxage=30` on `/api/radio/schedule`) to prevent repetitive serverless function executions.
- [x] **Browser Inactive Tab Visibility Pause**: Suspended polling in `AudioPlayer`, `UpNextSection`, `ScheduleView`, and `LiveListenersBadge` when browser tabs are hidden/minimized.
- [x] **Search Crawler Blocking on Preview Deployments**: Automated dynamic `robots.txt` generation in `generateRobotsConfig` to disallow all crawling on non-production deployments.
- [x] **Slimmed GitHub Actions CI Pipeline**: Added change scope detection in `ci.yml`, Playwright browser caching (`~/.cache/ms-playwright`), Next.js `.next/cache` restoration, 20m Stryker timeout, and Dependabot bypass for heavy suites.
- [x] **4-Way Operational Budget Controls**: Documented and verified budget commands across Terminal CLI (`npm run promptfm -- budget`), MCP Tools (`promptfm_admin_get_infra_budget`), and Admin documentation.


