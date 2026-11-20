// src/lib/faq/faq-data.ts
// Structured Knowledge Base & FAQ entries covering PromptFM architecture, AI models, and policies.

export interface FaqCategory {
  slug: string;
  name: string;
  description: string;
}

export interface FaqItem {
  id: string;
  categorySlug: string;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    slug: 'station-architecture',
    name: 'Station Architecture & AI DJs',
    description: 'How PromptFM operates 24/7 autonomous clock-wheel broadcasting with Google Gemini AI DJs.',
  },
  {
    slug: 'ai-synthesis',
    name: 'AI Music Synthesis & Tools',
    description: 'Foundation audio models including Suno v3.5, Udio v1.5, and Stable Audio 2.0.',
  },
  {
    slug: 'community-governance',
    name: 'Community Governance & Charts',
    description: 'Listener upvoting, song queue mechanics, and weekly countdown charts.',
  },
  {
    slug: 'copyright-licensing',
    name: 'Copyright, Safety & Licensing',
    description: 'Commercial broadcast rights, DMCA Safe Harbor (17 U.S.C. § 512), and anti-voice clone safeguards.',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'how-station-works',
    categorySlug: 'station-architecture',
    question: 'How does PromptFM broadcast 24/7 without human intervention?',
    answer:
      'PromptFM utilizes an autonomous clock-wheel rotation engine paired with Google Gemini models. The scheduler arranges musical rotations, station identification drops, community dedications, and transitions dynamically. Resident AI DJ personas generate contextual banter, artist credits, and mood reflections between tracks using neural text-to-speech synthesis.',
  },
  {
    id: 'ai-dj-personalities',
    categorySlug: 'station-architecture',
    question: 'Who are the resident AI DJs and how do they curate their shifts?',
    answer:
      'PromptFM features four distinct AI DJ personas scheduled around the clock: DJ Neon on the Main Stage (high-energy synthwave and electro-pop), DJ Cipher on Cyberpunk After Dark (industrial textures and analytical commentary), DJ Luna on Chillout & Ambient (calming, meditative lo-fi beats), and DJ Pixel on Kids & Family (cheerful 8-bit chiptunes and singalongs).',
  },
  {
    id: 'supported-ai-tools',
    categorySlug: 'ai-synthesis',
    question: 'Which AI music generation tools are supported on PromptFM?',
    answer:
      'PromptFM supports original compositions synthesized through leading generative audio foundation models, specifically Suno (v3 and v3.5), Udio (v1 and v1.5), Stable Audio (2.0), and verified custom open-weight diffusion architectures. Every track in our public library displays the tool used.',
  },
  {
    id: 'semantic-search-pgvector',
    categorySlug: 'ai-synthesis',
    question: 'How does semantic prompt matching work for song discovery?',
    answer:
      'Every track submitted to PromptFM has its prompt, lyrics, instruments, and mood converted into high-dimensional vector embeddings stored in PostgreSQL using pgvector. When listeners request a mood or aesthetic via Discord or Telegram bots, the system performs cosine similarity lookups to match the perfect track in milliseconds.',
  },
  {
    id: 'how-voting-works',
    categorySlug: 'community-governance',
    question: 'How does community voting affect track airplay and rotation?',
    answer:
      'Listeners can vote for any track directly on the web player, library catalog, charts page, or via bot commands. Each vote increases the track’s rotational weight in our autonomous clock wheel. The top 20 highest-voted tracks of each week are featured prominently in the Weekly Charts countdown show.',
  },
  {
    id: 'song-requests-queue',
    categorySlug: 'community-governance',
    question: 'Can listeners request songs to play live on air?',
    answer:
      'Yes. Listeners can enqueue tracks through the Public Library page or by typing `/song <title or prompt>` in Discord and Telegram. The unified broadcast pathway checks anti-repeat rules, calculates the live queue depth and estimated time of arrival (ETA), and inserts the song into the upcoming schedule.',
  },
  {
    id: 'commercial-rights-requirement',
    categorySlug: 'copyright-licensing',
    question: 'Do creators need commercial rights to submit AI music?',
    answer:
      'Yes. PromptFM requires submitters to confirm that they hold commercial broadcast rights to their generated audio. For Suno and Udio, this typically requires creating the track while holding an active Pro or Premier paid tier subscription. Free-tier creations without commercial licenses are not permitted.',
  },
  {
    id: 'voice-clone-restrictions',
    categorySlug: 'copyright-licensing',
    question: 'Are vocal deepfakes or celebrity voice clones allowed on PromptFM?',
    answer:
      'No. PromptFM strictly enforces an anti-voice clone policy. Any track that attempts to impersonate or clone the likeness of real living artists, public figures, or non-consenting individuals is automatically rejected or purged upon notice.',
  },
  {
    id: 'dmca-compliance',
    categorySlug: 'copyright-licensing',
    question: 'How does PromptFM handle DMCA copyright takedown notices?',
    answer:
      'PromptFM adheres strictly to 17 U.S.C. § 512 and European Digital Services Act regulations. We maintain a registered DMCA designated agent (dmca@promptfm.live) and an automated intake form at /dmca. Valid statutory takedown notices result in expedited review and removal within 24 hours.',
  },
  {
    id: 'parental-controls-watershed',
    categorySlug: 'copyright-licensing',
    question: 'How are explicit lyrics and family content moderated?',
    answer:
      'PromptFM enforces automated Whisper and Gemini lyric scanning on all uploads. Explicit lyrics are tagged with an 18+ badge and restricted to late-night watershed hours or Channel 2 (Cyberpunk After Dark). Channel 4 (Kids & Family) enforces zero-tolerance family isolation.',
  },
  {
    id: 'audio-quality-standards',
    categorySlug: 'ai-synthesis',
    question: 'What audio formats and quality standards are required for broadcast?',
    answer:
      'Submitted tracks must be uploaded in MP3 format with a minimum bitrate of 192 kbps (up to 320 kbps), mastered without digital clipping or severe generation artifacts, and under 12 MB in total file size. Our streaming server encodes the live broadcast at 192 kbps stereo AAC/MP3.',
  },
];

export function getAllFaqItems(): FaqItem[] {
  return FAQ_ITEMS;
}

export function getFaqItemsByCategory(categorySlug: string): FaqItem[] {
  return FAQ_ITEMS.filter((item) => item.categorySlug === categorySlug);
}
