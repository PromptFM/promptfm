// src/lib/community/commands.ts
// Listener bot commands directory, help text generators, and airplay schedule metadata

export interface ListenerCommandDef {
  command: string;
  desc: string;
  category: 'Airplay' | 'Info' | 'Community' | 'Interactive' | 'Help';
  example: string;
}

export const LISTENER_COMMANDS: ListenerCommandDef[] = [
  {
    command: '/song <vibe or title>',
    desc: 'Queue an AI track matching your vibe into the live stream next',
    category: 'Airplay',
    example: '/song synthwave cyberpunk sunset',
  },
  {
    command: '/queue',
    desc: 'View the upcoming 5 songs in rotation and listener requests',
    category: 'Airplay',
    example: '/queue',
  },
  {
    command: '/nowplaying',
    desc: 'See live track metadata, host AI DJ, and tap to upvote',
    category: 'Info',
    example: '/nowplaying',
  },
  {
    command: '/vote <track_id>',
    desc: 'Cast an upvote for any track to boost its weekly chart ranking',
    category: 'Airplay',
    example: '/vote 186f9b8c-557858',
  },
  {
    command: '/dedicate @friend <message>',
    desc: 'Schedule a personalized on-air shoutout by the active DJ',
    category: 'Community',
    example: '/dedicate @maria Happy Birthday from PromptFM!',
  },
  {
    command: '/weather <city>',
    desc: 'Request a live regional weather forecast in the next drop',
    category: 'Interactive',
    example: '/weather Tokyo',
  },
  {
    command: '/zodiac <sign>',
    desc: 'Request a fun cosmic AI astrological reading',
    category: 'Interactive',
    example: '/zodiac Scorpio',
  },
  {
    command: '/report <track_id> <reason>',
    desc: 'Alert station moderators of a standards violation or issue',
    category: 'Help',
    example: '/report track-101 Explicit lyrics on family channel',
  },
  {
    command: '/help',
    desc: 'View the full interactive command cheat sheet and guidelines',
    category: 'Help',
    example: '/help',
  },
];

export function getBotHelpText(format: 'markdown_v1' | 'telegram' | 'discord' = 'markdown_v1'): string {
  if (format === 'discord') {
    return `📻 **PromptFM Interactive Bot & Broadcast Guide**

**Live Airplay & Queue Commands (Canonical & Shorthands):**
• \`/nowplaying\` or \`/np\` — View the live song, artist, AI tool, host DJ, and upvote score.
• \`/queue\` (\`/q\`) or \`/next\` (\`/n\`) — View upcoming songs in rotation and pending listener requests.
• \`/song <vibe or title>\` or \`/s <vibe>\` — Request an AI track into the live airplay queue! (e.g. \`/s synthwave\`)
• \`/vote <track_id>\` — Cast an upvote for any track to boost its weekly chart ranking.

**Community Shoutouts & Interactive Drops:**
• \`/dedicate <to> <message>\` or \`/d <to> <message>\` — Send a dedication to be announced on air.
• \`/weather <city>\` or \`/w <city>\` — Request live regional weather check.
• \`/zodiac <sign>\` or \`/z <sign>\` — Request a fun AI astrological reading.
• \`/report <target> <reason>\` or \`/r <target> <reason>\` — Alert station moderation of an issue.
• \`/help\` or \`/h\` — View this commands cheat sheet.

**⏰ Airplay Schedule & When Songs Play:**
• **Song Requests (\`/song\` or \`/s\`):** Accepted 24/7! Enqueued into \`channel_queue\` and played next in the live stream.
• **Hourly Clock Wheel Cadence:**
  - \`:00 - :15\` — Top 40 Power Rotation (Top community voted hits)
  - \`:15 - :30\` — Deep Cuts & Ambient Explorations
  - \`:30 - :45\` — Rhythm Transition (Breakbeats & Synthwave)
  - \`:45 - :00\` — **Listener Showcase & Community Requests** *(Your requested songs take the spotlight!)*
• **Dedications & Voice Drops:** Batched every 15 minutes (\`:00\`, \`:15\`, \`:30\`, \`:45\`) to keep the music continuous.

Tune in live: https://promptfm.live`;
  }

  return `📻 *PromptFM Interactive Bot & Broadcast Guide*

*Live Airplay & Queue Commands (Canonical & Shorthands):*
• /nowplaying or /np — View current live track, host DJ, and upvote directly with buttons.
• /queue (/q) or /next (/n) — View upcoming songs in rotation and pending listener requests.
• /song <vibe or title> or /s <prompt> — Queue an approved AI track into live broadcast next!
• /vote <track_id> — Cast an upvote for any track to boost its chart standing.

*Community Shoutouts & Interactive Drops:*
• /dedicate @friend <message> or /d @friend <message> — Schedule a shoutout on air.
• /weather <city> or /w <city> — Request live weather report in next drop.
• /zodiac <sign> or /z <sign> — Request cosmic horoscope reading.
• /report <track_id> <reason> or /r <track_id> <reason> — Alert station moderators.
• /help or /h — View this commands cheat sheet.

*⏰ Airplay Schedule & When Songs Play:*
• *Song Requests (/song or /s):* Accepted 24/7! Enqueued and played next in live stream.
• *Hourly Clock Wheel Cadence:*
  - :00 - :15 — Top 40 Power Rotation (Top community hits)
  - :15 - :30 — Deep Cuts & Ambient Explorations
  - :30 - :45 — Rhythm Transition (Breakbeats & Synthwave)
  - :45 - :00 — *Listener Showcase & Community Requests* (Your requested tracks!)
• *Dedications & Voice Drops:* Consolidated every 15 minutes (:00, :15, :30, :45) so music stays uninterrupted.

Tune in live: https://promptfm.live`;
}

