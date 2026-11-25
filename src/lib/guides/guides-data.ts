// src/lib/guides/guides-data.ts
// Comprehensive editorial guides and documentation repository for PromptFM.
// Provides substantial, authentic, high-quality technical and educational resources.
// Complies with Google AdSense Publisher Content & Unique Value Policies.

export interface GuideSection {
  heading: string;
  body: string;
  subsections?: {
    title: string;
    content: string;
  }[];
}

export interface EditorialGuide {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  canonicalPath: string;
  readingTimeMinutes: number;
  lastUpdated: string;
  author: string;
  keywords: string[];
  isTechnical: boolean;
  sections: GuideSection[];
}

export const EDITORIAL_GUIDES: EditorialGuide[] = [
  {
    slug: 'prompt-engineering',
    title: 'Mastering AI Music Prompt Engineering: The Definitive Guide',
    metaTitle: 'Mastering AI Music Prompt Engineering | Suno, Udio & Stable Audio Guide',
    description:
      'In-depth handbook on prompt engineering for neural audio models (Suno, Udio, Stable Audio): structure tags, harmonic descriptors, genre blending, acoustic mixing directives, and mastering for broadcast.',
    canonicalPath: '/guides/prompt-engineering',
    readingTimeMinutes: 12,
    lastUpdated: '2026-11-25',
    author: 'PromptFM Editorial Engineering Team',
    isTechnical: true,
    keywords: [
      'AI Music Prompt Engineering',
      'Suno v3.5 Prompts',
      'Udio v1.5 Prompt Guide',
      'Stable Audio Prompts',
      'Generative Audio Synthesis',
      'Music Prompt Syntax',
      'AI Radio Production',
    ],
    sections: [
      {
        heading: '1. Foundations of Neural Audio Synthesis & Prompt Tokens',
        body: 'Generative music models such as Suno, Udio, and Stable Audio differ fundamentally from large language models. Rather than operating purely in symbolic token space, modern neural audio systems utilize diffusion and autoregressive transformers trained on Mel-spectrograms and latent audio representations. To achieve consistent musicality, prompt engineers must understand how natural language inputs map to acoustic latent spaces, harmonic progressions, and timbral envelopes.',
        subsections: [
          {
            title: 'Descriptive Density vs. Token Overload',
            content:
              'Neural audio generators exhibit diminishing acoustic returns when overloaded with contradictory adjectives. Successful prompts focus on five critical pillars: Primary Genre, Secondary Sub-genre, Instrumentation, Harmonic Mood/Tonality, and Production Style.',
          },
          {
            title: 'Temporal Evolution & Song Phrasing',
            content:
              'Unlike static text generation, music exists in time. Providing explicit song structure markers in lyrics or meta-tags instructs the transformer to execute dynamic drops, bridge variations, and harmonic resolution.',
          },
        ],
      },
      {
        heading: '2. Structural Meta-Tags & Song Architecture',
        body: 'Modern generative audio models support structural meta-tags that dictate arrangement and instrument density across song segments. Incorporating square-bracket tags into your prompt lyrics establishes clean verse-chorus transitions, energetic crescendos, and quiet intros.',
        subsections: [
          {
            title: 'Arrangement Meta-Tags',
            content:
              '[Intro] — Sparse instrumentation, establishing key signature and tempo.\n[Verse 1] — Narrative build with driving rhythm section.\n[Pre-Chorus] — Rising tension, pitch modulation, and snare roll build-up.\n[Chorus] — Full harmonic spectrum, layered vocals, wide stereo image.\n[Bridge] — Melodic departure, rhythm breakdown, or key shift.\n[Guitar Solo / Synth Breakdown] — Instrumental showcase with dynamic filter sweeps.\n[Outro / Fade Out] — Decrescendo ending with lingering reverb tail.',
          },
          {
            title: 'Vocal Styling Tags',
            content:
              'Use [Male Baritone Vocals], [Female Ethereal Soprano], [Auto-tuned Phrasing], [Whispered Vocals], or [Choir Backing Harmonies] to prevent random vocal timbre switching across audio generation chunks.',
          },
        ],
      },
      {
        heading: '3. Acoustic Descriptors, Production Styles & Mixing Directives',
        body: 'A prompt is not merely a genre label; it is a virtual recording studio directive. Specifying audio engineering attributes directly influences the spatial depth, dynamic range, and frequency response of the synthesized master.',
        subsections: [
          {
            title: 'Sonic Environment & Spatial Directives',
            content:
              'Terms such as "warm analog tape saturation", "spacious plate reverb", "dry close-mic vocals", "binaural stereo panning", and "sub-bass 808 compression" provide the diffusion model with distinct timbral constraints.',
          },
          {
            title: 'BPM & Rhythmic Cadence Anchoring',
            content:
              'Always specify tempo ranges (e.g., "128 BPM progressive house" or "84 BPM lo-fi hip hop"). Neural audio models use tempo descriptors to align rhythmic quantization, kick-drum transient velocity, and hi-hat swing patterns.',
          },
        ],
      },
      {
        heading: '4. Platform-Specific Nuances: Suno v3.5 vs. Udio v1.5 vs. Stable Audio',
        body: 'Each frontier audio generation model possesses a unique training corpus, token weight mechanism, and latent representation strategy. Understanding these differences allows producers to maximize output quality across platforms.',
        subsections: [
          {
            title: 'Suno v3.5 Strengths & Best Practices',
            content:
              'Suno excels at cohesive song length, catchy hooks, and rapid genre blending. It responds best to genre-first prompts followed by mood and tempo tags. Keep custom style prompts under 120 characters for optimal adherence.',
          },
          {
            title: 'Udio v1.5 Precision & Audio Clarity',
            content:
              'Udio offers exceptional vocal clarity, nuanced jazz harmonies, and intricate instrumental solos. Use manual prompt mode with genre tags separated by commas. Employ negative prompt keywords like "muddy mix, low-pass filter, distorted vocals" to preserve dynamic headroom.',
          },
          {
            title: 'Stable Audio & Ambient Soundscapes',
            content:
              'Stable Audio is built on latent diffusion for sample-accurate stereo synthesis. It is ideal for continuous background textures, synthwave pads, cinematic orchestral cues, and rhythm loops with zero vocal artifacts.',
          },
        ],
      },
      {
        heading: '5. Broadcast Mastering & PromptFM Airplay Readiness',
        body: 'Before submitting an AI-generated song to PromptFM for 24/7 radio rotation, creators must verify acoustic broadcast standards. PromptFM normalizes all audio to -14 LUFS integrated loudness following the international ITU-R BS.1770 / EBU R128 broadcasting specification.',
        subsections: [
          {
            title: 'Loudness & Dynamic Range',
            content:
              'Avoid heavy digital limiting or clipping in post-production. True-peak levels should not exceed -1.0 dBFS to prevent inter-sample distortion when streaming over 192 kbps AAC and MP3 codecs.',
          },
          {
            title: 'Editorial Metadata Curation',
            content:
              'Provide accurate title, artist, genre tags, and the exact model used (e.g. Suno v3.5, Udio v1.5). PromptFM embeds this data into live stream ICY metadata and Discord / Telegram listener embeds.',
          },
        ],
      },
    ],
  },
  {
    slug: 'radio-architecture',
    title: 'Inside PromptFM: The Architecture of Autonomous 24/7 AI Radio',
    metaTitle: 'Autonomous AI Radio Architecture | Clock-Wheels & Neural DJs at PromptFM',
    description:
      'Deep dive into the software architecture behind PromptFM: autonomous Google Gemini DJ personas, broadcast clock-wheel scheduling, pgvector semantic retrieval, and low-latency audio streaming.',
    canonicalPath: '/guides/radio-architecture',
    readingTimeMinutes: 10,
    lastUpdated: '2026-11-25',
    author: 'PromptFM System Architecture Team',
    isTechnical: true,
    keywords: [
      'Autonomous Radio Architecture',
      'AI Radio Station Software',
      'Clock-Wheel Scheduling Engine',
      'Google Gemini AI DJs',
      'pgvector Audio Retrieval',
      'EBU R128 Audio Normalization',
      'Icecast HLS Streaming',
    ],
    sections: [
      {
        heading: '1. Traditional Broadcast Clock Wheels vs. Autonomous Neural Scheduling',
        body: 'For over eight decades, terrestrial radio programming has adhered to the "clock wheel"—a circular hourly schedule that orchestrates the ratio of high-rotation hits, fresh discoveries, station identifications, sponsor reads, and spoken DJ drops. PromptFM digitizes and automates this historic methodology using real-time algorithmic state machines.',
        subsections: [
          {
            title: 'The Hourly Rotation Matrix',
            content:
              'Each 60-minute cycle on PromptFM Main Stage executes a structured clock: [T+00] Top of the Hour Station ID + Headline Hit -> [T+04] Resident AI DJ Shift Briefing -> [T+07] Community Request -> [T+11] Emerging Artist Discovery -> [T+15] Sponsor Billboard -> [T+20] Chart Countdown -> [T+35] Watershed Safety Transition.',
          },
          {
            title: 'Dynamic Cadence Adaptation',
            content:
              'Rather than playing static pre-rendered playlists, the clock wheel calculates current queue depth, recent genre distribution, and listener voting trends to eliminate track repetition and prevent tonal fatigue.',
          },
        ],
      },
      {
        heading: '2. Autonomous AI DJ Personas Powered by Google Gemini',
        body: 'PromptFM does not employ synthetic audio loops or repetitive robotic clips. Resident DJ personas are powered by Google Gemini multimodal models, generating context-aware spoken banter that reflects the current time of day, active channel theme, recent community votes, and song trivia.',
        subsections: [
          {
            title: 'Persona Prompts & Emotional Temperament',
            content:
              'Each DJ possesses a detailed persona prompt: DJ Neon delivers energetic electronic and synthwave commentary; DJ Cipher hosts late-night cyberpunk with edgy analytical wit; DJ Luna offers soothing ambient reflections; DJ Pixel brings wholesome chiptune humor for family listeners.',
          },
          {
            title: 'Neural Text-to-Speech (TTS) Synthesis',
            content:
              'Gemini-generated scripts are synthesized via high-fidelity neural voice pipelines, matched for vocal timbre, pitch cadence, and speech rate, before being seamlessly mixed over musical ducking beds.',
          },
        ],
      },
      {
        heading: '3. Semantic Audio Retrieval with PostgreSQL & pgvector',
        body: 'When listeners request songs via Discord slash commands (/song) or Telegram bots (/s), traditional keyword lookup often fails to capture the nuanced emotion or mood of the request. PromptFM uses vector embeddings stored in PostgreSQL via the pgvector extension.',
        subsections: [
          {
            title: 'High-Dimensional Embedding Indexing',
            content:
              'Every track in the PromptFM catalog is embedded across its textual prompt, musical genre tags, lyrical themes, and tempo characteristics. Queries like "/song moody rainy midnight drive in neo-tokyo" are embedded into vector space to find the nearest cosine neighbors in under 15 milliseconds.',
          },
          {
            title: 'Deduplication & Queue Guardrails',
            content:
              'Before enqueuing a requested track, the unified pathway checks whether the song is already on air, currently queued, or has been broadcast within the artist-separation interval (enforcing statutory DMCA sound recording performance rules).',
          },
        ],
      },
      {
        heading: '4. Audio Pipeline: Cloudflare R2, Edge CDN & EBU R128 Normalization',
        body: 'High availability and pristine sound quality require a robust streaming infrastructure. PromptFM stores full-resolution audio assets on Cloudflare R2 and streams them across global edge networks.',
        subsections: [
          {
            title: 'LUFS Loudness Normalization',
            content:
              'To eliminate jarring volume discrepancies between tracks generated on different AI platforms, our automated ingestion worker analyzes integrated LUFS loudness and applies two-pass gain offsets to achieve uniform -14 LUFS playback.',
          },
          {
            title: 'Zero-Egress Cost Edge Delivery',
            content:
              'Utilizing Cloudflare R2 S3-compatible object storage allows PromptFM to stream tens of thousands of continuous audio hours to listeners worldwide without incurring bandwidth egress penalties.',
          },
        ],
      },
    ],
  },
  {
    slug: 'editorial-standards',
    title: 'PromptFM Editorial Standards, Curation Charter & Content Integrity',
    metaTitle: 'Editorial Standards & Curation Charter | PromptFM Community Integrity',
    description:
      'Official guidelines for PromptFM broadcast curation, automated lyric safety screening, parental advisory watershed controls, copyright licensing, and anti-gaming voting rules.',
    canonicalPath: '/editorial-standards',
    readingTimeMinutes: 8,
    lastUpdated: '2026-11-25',
    author: 'PromptFM Editorial Board',
    isTechnical: false,
    keywords: [
      'PromptFM Editorial Standards',
      'AI Music Curation Policy',
      'Broadcasting Standards',
      'Parental Advisory Watershed',
      'DMCA Copyright Compliance',
      'Community Voting Integrity',
    ],
    sections: [
      {
        heading: '1. Mission & Editorial Philosophy',
        body: 'PromptFM is committed to creating a vibrant, ethical, and community-curated audio ecosystem for artificial intelligence music. We believe generative neural audio represents an empowering frontier for human creativity, songwriters, and producers. Our editorial mission is to curate, highlight, and broadcast the most innovative AI music while upholding strict standards of artistic respect, content safety, and operational transparency.',
      },
      {
        heading: '2. Multi-Stage Track Ingestion & Curation Pipeline',
        body: 'Every track submitted to PromptFM undergoes a rigorous multi-stage review process before it is approved for broadcast airplay.',
        subsections: [
          {
            title: 'Automated Lyric & Safety Screening',
            content:
              'Submissions are analyzed through automated natural language moderation models to detect hate speech, harassment, explicit violence, non-consensual content, or infringement of minors. Submissions containing prohibited content are immediately rejected.',
          },
          {
            title: 'Acoustic Quality & Audio Artifact Detection',
            content:
              'Tracks must exhibit clean dynamic balance, absent of high-frequency clipping, severe digital phasing, or jarring abrupt cutoffs. Tracks must meet minimum duration requirements (60 seconds) to ensure meaningful broadcast flow.',
          },
          {
            title: 'Community Voting & Curatorial Promotion',
            content:
              'Approved catalog tracks are submitted to open community voting. Listeners vote in real time through the web interface, Discord bot, and Telegram bot. Top-performing songs earn elevated rotational weight in daily prime-time countdowns.',
          },
        ],
      },
      {
        heading: '3. Parental Advisory & Watershed Broadcast Controls',
        body: 'In accordance with global broadcasting standards and family safety guidelines, PromptFM enforces strict channel isolation and temporal watershed boundaries.',
        subsections: [
          {
            title: 'Channel 4 (Kids & Family Safe) Strict Isolation',
            content:
              'Channel 4 is strictly dedicated to wholesome, educational, and family-appropriate content, including chiptunes, acoustic melodies, and nursery rhymes. Content with mature themes, romantic angst, or intense electronic bass is barred from Channel 4.',
          },
          {
            title: 'Watershed & 18+ Channels',
            content:
              'Explicit or uncensored tracks are strictly prohibited during daytime broadcast hours on Main Stage. Mature themes are exclusively restricted to designated after-dark hours (watershed) or Channel 5 (After Dark 18+), accompanied by visual parental advisory warnings.',
          },
        ],
      },
      {
        heading: '4. Intellectual Property, DMCA Safe Harbor & Commercial Grants',
        body: 'PromptFM respects original human authorship and intellectual property rights. We maintain strict compliance with the Digital Millennium Copyright Act (17 U.S.C. § 512).',
        subsections: [
          {
            title: 'Commercial AI Generation Rights',
            content:
              'Creators submitting tracks to PromptFM must hold commercial generation privileges from their respective neural synthesis platform (such as Suno Pro/Premier, Udio Standard/Pro, or Stable Audio commercial licenses) and certify that their generation prompts do not deliberately replicate or copy copyrighted human vocal likenesses or sound recordings.',
          },
          {
            title: 'Statutory Notice & Take-Down Procedure',
            content:
              'Rightsholders may report any concerns through our dedicated DMCA portal (/dmca) or by contacting our designated copyright agent at dmca@promptfm.live. Alleged infringing content is reviewed and withheld from broadcast rotation within 24 hours of notification.',
          },
        ],
      },
      {
        heading: '5. Voting Integrity & Anti-Gaming Governance',
        body: 'Democratic curation requires fair and uncompromised voting. PromptFM employs automated telemetry, IP rate limiting, browser fingerprint validation, and sybil resistance algorithms to prevent vote stuffing or artificial inflation of track standings. Any tracks identified as targets of coordinated bot voting are subjected to audit and score normalization.',
      },
    ],
  },
];

export function getGuideBySlug(slug: string): EditorialGuide | undefined {
  return EDITORIAL_GUIDES.find((g) => g.slug === slug);
}
