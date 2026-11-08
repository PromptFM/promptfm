# 📻 PromptFM Listener Command Guide & Airplay Schedule

Welcome to **PromptFM** — the 24/7 autonomous AI music radio station and community chart!

Listeners can directly control the radio stream, inspect the airplay queue, vote for songs into the weekly chart, and schedule tracks using interactive commands on **Web**, **Discord**, and **Telegram**.

---

## ⚡ Quick Command Cheat Sheet

| Command | Platform | Description | Example |
| :--- | :--- | :--- | :--- |
| `/song <title or vibe>` (or `/s`) | Web, Discord & Telegram | Requests and auto-enqueues an approved AI music track into the live radio stream next | `/song cyberpunk neon synthwave` |
| `/vibe <prompt>` | Web, Discord & Telegram | Semantic vector search for tracks matching a musical mood | `/vibe rainy midnight lofi` |
| `/queue`, `/next`, `/q`, `/n` | Web, Discord & Telegram | Displays upcoming airplay tracks and scheduled listener batch requests with ETA & status (never blank) | `/q` |
| `/nowplaying` or `/np` | Web, Discord & Telegram | Displays the active on-air song, artist, AI tool, host DJ, and interactive upvote button | `/nowplaying` |
| `/vote <track_id>` | Web, Discord & Telegram | Casts an upvote for any track to boost its weekly chart ranking | `/vote 186f9b8c-...` |
| `/dedicate @user <message>` | Discord & Telegram | Submits a shoutout or dedication to be announced in the next 15-minute batch | `/dedicate @maria Happy Birthday!` |
| `/weather <city>` | Discord & Telegram | Requests a live regional weather forecast in the next batch drop | `/weather Tokyo` |
| `/zodiac <sign>` | Discord & Telegram | Requests a futuristic AI music astrological reading | `/zodiac Scorpio` |
| `/report <track_id> <reason>` | Web, Discord & Telegram | Alerts station moderators of a broadcast standards or copyright issue | `/report track-123 Explicit lyrics` |
| `/help` or `/start` | Web, Discord & Telegram | Displays the interactive bot guide, commands list, and airplay schedule | `/help` |

---

## ⏰ When Do Requested Songs Play?

### 1. 24/7 On-Demand Live Queueing & Dynamic ETAs
* You can request a song at **any minute of the day or night** using `/song <vibe or title>`.
* PromptFM uses pgvector semantic similarity search (`findTracksByVibe`) to find the best match in our approved track library and enqueues it immediately into `channel_queue`.
* As soon as the current on-air track ends, the master rotation engine picks up the top item in `channel_queue` before returning to standard rotation!
* **Queue Position & Provisional ETAs:** The bot immediately confirms your song with your live queue position (e.g. `Position: Up next (#1 in queue)` or `Position: #2 in queue`) and a provisional ETA (e.g. `~17:10 UTC (est. in ~3m, provisional)`).
* **Track Updated Status:** Run `/queue` or `/next` at any time to view updated provisional play times and see exactly where your song is in line!

### 2. Hourly Clock Wheel Milestones (:00 to :59)
Every hour on PromptFM follows a structured 4-part radio clock wheel:

```
  ┌────────────────────────────────────────────────────────┐
  │              PROMPTFM HOURLY CLOCK WHEEL               │
  ├──────────────┬─────────────────────────────────────────┤
  │ :00 – :15    │ Community Headliners (Catalog Highlights)│
  ├──────────────┼─────────────────────────────────────────┤
  │ :15 – :30    │ Deep Cuts & Ambient Explorations        │
  ├──────────────┼─────────────────────────────────────────┤
  │ :30 – :45    │ Rhythm Transition (Breakbeats/Synthwave)│
  ├──────────────┼─────────────────────────────────────────┤
  │ :45 – :00    │ 🌟 LISTENER SHOWCASE & COMMUNITY QUEUE  │
  └──────────────┴─────────────────────────────────────────┘
```

* **`:45 to :00` Listener Showcase:** This is the dedicated quarter-hour block of the broadcast where community submissions and listener requested tracks take top billing across all channels!

---

## 🎙️ How Do Dedications and Shoutouts Work?

To protect our promise of **uninterrupted, 100% pure music airplay**, individual listener requests do not constantly interrupt playback with speech.

1. **15-Minute Batch Slots:**
   * Radio hours are divided into 4 quarter-hour batches:
     * `BATCH-:00`
     * `BATCH-:15`
     * `BATCH-:30`
     * `BATCH-:45`
2. **Consolidated Spoken Drops:**
   * When an announcement slot arrives, the active AI DJ reads **all collected listener dedications together** in a single, warm, concise 30-to-45-second radio drop.
3. **Admin Exclusivity for Speech:**
   * Only authenticated station operators can trigger spoken broadcast drops or batch airplay, guaranteeing zero audio spam or live override by unvetted bots.

---

## 🛡️ Content Safety & Ethical Broadcast Guardrails

All listener submissions undergo automatic pre-flight safety screening via PromptFM safety guardrails before entering the queue:
* Explicit obscenity, hate speech, harassment, and severe profanity are blocked upfront.
* On child-safe channels (like **Kids & Family**), only tracks strictly verified as `family_friendly: true` may be queued.
* Any declined request receives an immediate private notification explaining the station moderation reason.

---

## 📱 How to Connect

* **Tune In Live:** [promptfm.live](https://promptfm.live)
* **Discord Server:** [discord.gg/promptfm](https://discord.gg/promptfm)
* **Telegram Channel:** [@promptfm_live](https://t.me/promptfm_live)
* **Telegram Bot:** [@PromptFMLiveBot](https://t.me/PromptFMLiveBot)

