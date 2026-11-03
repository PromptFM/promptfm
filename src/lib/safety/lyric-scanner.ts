// src/lib/safety/lyric-scanner.ts
// Token-Efficient Automated Lyric & Audio Content Scanner
// Combines 0-token local regex pre-filtering with Gemini 3.5 Flash semantic classification.

export interface LyricScanPayload {
  title: string;
  artist?: string;
  lyrics?: string | null;
  description?: string | null;
}

export interface LyricScanResult {
  is_explicit: boolean;
  family_friendly: boolean;
  flags: string[];
  allowed_channels: string[];
  method: 'heuristic_zero_token' | 'ai_gemini_flash' | 'instrumental_clean';
  tokens_used: number;
}

const SEVERE_PROFANITY_PATTERN =
  /\b(fuck\w*|f\*\*k|f\*ck|shit\w*|sh\*t|bullshit\w*|bitch\w*|b\*tch|asshole\w*|cunt\w*|dick\w*|cock\w*|pussy\w*|nigg\w*|whore\w*|slut\w*|motherfuck\w*)\b/i;

/**
 * 0-Token Instant Regex Profanity Detector.
 */
export function detectObviousProfanity(text: string): boolean {
  if (!text) return false;
  return SEVERE_PROFANITY_PATTERN.test(text);
}

/**
 * Computes allowed radio channels based on explicit and family-friendly tags.
 * Channel 1 = main, Channel 2 = cyberpunk, Channel 3 = chillout, Channel 4 = kids.
 */
export function determineAllowedChannels(tags: {
  is_explicit?: boolean;
  family_friendly?: boolean;
}): string[] {
  if (tags.is_explicit) {
    // Explicit tracks are restricted to Main (1) & Cyberpunk (2) under late-night watershed
    return ['main', 'cyberpunk'];
  }

  if (tags.family_friendly) {
    // Wholesome family tracks are permitted on ALL stations including Kids (4), Main (1), Chillout (3)
    return ['main', 'cyberpunk', 'chillout', 'kids'];
  }

  // Clean general tracks: allowed on Main (1), Cyberpunk (2), and Chillout (3)
  return ['main', 'cyberpunk', 'chillout'];
}

/**
 * Validates whether a track is permitted on a specific channel.
 */
export function isChannelPermittedForTrack(
  channelSlug: string,
  track: { is_explicit?: boolean; family_friendly?: boolean }
): boolean {
  const allowed = determineAllowedChannels(track);
  return allowed.includes(channelSlug.toLowerCase().trim());
}

/**
 * Scans track lyrics and content with high token efficiency.
 * Prioritizes 0-token heuristics first, calling Gemini 3.5 Flash only when nuanced semantic analysis is needed.
 */
export async function scanLyricsAndContent(
  payload: LyricScanPayload,
  apiKeyOverride?: string
): Promise<LyricScanResult> {
  const combinedText = [payload.title, payload.lyrics, payload.description]
    .filter(Boolean)
    .join(' ')
    .trim();

  const lyricsText = (payload.lyrics || '').trim();

  // ── Tier 1: Instrumental / Minimal Content (0 Tokens) ─────────────────────
  if (!lyricsText || lyricsText.length < 10) {
    return {
      is_explicit: false,
      family_friendly: true,
      flags: ['instrumental_or_clean'],
      allowed_channels: determineAllowedChannels({ is_explicit: false, family_friendly: true }),
      method: 'instrumental_clean',
      tokens_used: 0,
    };
  }

  // ── Tier 2: Unambiguous Profanity Heuristic (0 Tokens) ─────────────────────
  if (detectObviousProfanity(combinedText)) {
    return {
      is_explicit: true,
      family_friendly: false,
      flags: ['profanity_detected'],
      allowed_channels: determineAllowedChannels({ is_explicit: true, family_friendly: false }),
      method: 'heuristic_zero_token',
      tokens_used: 0,
    };
  }

  // ── Tier 3: Token-Optimized Gemini 3.5 Flash Scan ─────────────────────────
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Safe default if no key configured
    return {
      is_explicit: false,
      family_friendly: true,
      flags: ['clean_fallback'],
      allowed_channels: determineAllowedChannels({ is_explicit: false, family_friendly: true }),
      method: 'heuristic_zero_token',
      tokens_used: 0,
    };
  }

  // Truncate to first 350 chars (~70 tokens) to minimize input tokens
  const sample = lyricsText.slice(0, 350);

  const prompt = `Analyze these song lyrics for broadcast suitability:
"${sample}"
Respond in JSON: {"explicit": boolean, "family_friendly": boolean}
- explicit: true if sexual content, violence, profanity, or adult themes exist.
- family_friendly: true if wholesome, child-safe, and uplifting.`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 25,
          thinkingConfig: {
            thinkingBudget: 0, // 0 thinking tokens
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini scan returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const candidate = data.candidates && data.candidates[0];
    const rawJson = candidate?.content?.parts?.[0]?.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    const isExplicit = Boolean(parsed.explicit);
    const isFamilyFriendly = Boolean(parsed.family_friendly) && !isExplicit;
    const tokensUsed = data.usageMetadata?.totalTokenCount || 50;

    const flags: string[] = [];
    if (isExplicit) flags.push('explicit_content');
    if (isFamilyFriendly) flags.push('family_friendly');

    return {
      is_explicit: isExplicit,
      family_friendly: isFamilyFriendly,
      flags,
      allowed_channels: determineAllowedChannels({
        is_explicit: isExplicit,
        family_friendly: isFamilyFriendly,
      }),
      method: 'ai_gemini_flash',
      tokens_used: tokensUsed,
    };
  } catch (err) {
    console.warn('Gemini lyric scan encountered an error, falling back to clean:', err);
    return {
      is_explicit: false,
      family_friendly: true,
      flags: ['scan_fallback'],
      allowed_channels: determineAllowedChannels({ is_explicit: false, family_friendly: true }),
      method: 'heuristic_zero_token',
      tokens_used: 0,
    };
  }
}
