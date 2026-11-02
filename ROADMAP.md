# PromptFM Engineering Roadmap & Feature Checklist

This document tracks upcoming features, architectural milestones, and infrastructure enhancements for PromptFM. Items are checked off as they are developed and verified through our Test-Driven Development (TDD) workflow.

---

## 🎯 Active Milestones & Backlog

### 1. 24/7 Continuous Audio Stream Server (GCP Free Tier)
- [ ] **GCP Always Free `e2-micro` VM Setup**: Provision a free-tier Compute Engine instance (`us-central1`, 1 GB RAM, 30 GB PD) running Docker.
- [ ] **Icecast 2 / Liquidsoap Continuous Broadcaster**: Configure Liquidsoap script that queries PromptFM's clock wheel, fetches R2 MP3s & Gemini DJ voice drops, and outputs a continuous 128 kbps MP3 stream.
- [ ] **Zero-Egress Proxy via Cloudflare Tunnel (`cloudflared`)**: Connect the Icecast mount point (`/stream.mp3`) to Cloudflare CDN to avoid GCP egress charges and provide HTTPS streaming.
- [ ] **AudioPlayer Live Stream Sync**: Connect web frontend [`AudioPlayer.tsx`](src/components/AudioPlayer.tsx) to the live continuous mount with seamless fallback.

---

### 2. Autonomous 24/7 Playback & Clock Daemon
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
