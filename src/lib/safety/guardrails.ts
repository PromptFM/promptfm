// src/lib/safety/guardrails.ts
// PromptFM Broadcast Standards, Ethics & Parental Control Guardrails
// Enforces:
//   1. Ethical & inclusive standards (refuses hate speech, harassment, threats)
//   2. Religious respect (refuses mockery, defamation, or hostility towards faiths)
//   3. Parental control (detects 18+ adult themes, sexual content, severe profanity)

export interface GuardrailResult {
  safe: boolean;
  is18Plus: boolean;
  category: 'clean' | 'religious_hostility' | 'explicit_18_plus' | 'hate_speech' | 'harassment' | 'violence';
  reason?: string;
  refusalMessage?: string;
}

// ── Deterministic Heuristic Pre-Filter (Zero-latency instant blocklist) ───────

const EXPLICIT_ADULT_PATTERNS = [
  /\b(porn|pornographic|nsfw|xxx|blowjob|cumshot|gangbang|hardcore\s*sex|anal\s*sex|hentai)\b/i,
  /\b(orgasm|erotic\s*roleplay|pedophil\w*|cp\b|incest)\b/i,
];

const RELIGIOUS_HOSTILITY_PATTERNS = [
  /\b(f\w+k|burn|destroy|hate|kill\s*all)\s+(christians|muslims|jews|hindus|buddhists|islam|christianity|judaism|quran|bible|torah|prophet|god|jesus|allah|mosque|church|synagogue)\b/i,
  /\b(death\s*to)\s+(islam|christianity|judaism|muslims|christians|jews)\b/i,
  /\b(mock|ridicule|defile)\s+(the\s*prophet|the\s*pope|holy\s*spirit|god|allah)\b/i,
];

const HATE_SPEECH_PATTERNS = [
  /\b(nigg\w*|kike\w*|chink\w*|faggot\w*|spic\w*|wetback\w*|gook\w*|towelhead\w*)\b/i,
  /\b(white\s*supremac\w*|neo-nazi|hitler\s*was\s*right|gas\s*the\s*jews)\b/i,
  /\b(kill\s*yourself|kys|commit\s*suicide|hang\s*yourself)\b/i,
];

/**
 * 1. Fast-path deterministic regex evaluation.
 */
export function evaluateHeuristicGuardrails(text: string): GuardrailResult {
  const normalized = text.toLowerCase();

  // 1. Hate speech / threats
  for (const pattern of HATE_SPEECH_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        safe: false,
        is18Plus: true,
        category: 'hate_speech',
        reason: 'Hate speech, slurs, or harassment violate PromptFM community standards.',
        refusalMessage: '🚫 Request declined: PromptFM strictly prohibits hate speech, targeted slurs, and harassment.',
      };
    }
  }

  // 2. Religious hostility / defamation
  for (const pattern of RELIGIOUS_HOSTILITY_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        safe: false,
        is18Plus: true,
        category: 'religious_hostility',
        reason: 'Hostility, defamation, or attacks targeting religious communities or beliefs violate broadcast ethics.',
        refusalMessage: '🚫 Request declined: Religious hostility, mockery, and faith-targeted attacks violate PromptFM broadcast ethics.',
      };
    }
  }

  // 3. 18+ Adult / sexually explicit
  for (const pattern of EXPLICIT_ADULT_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        safe: false,
        is18Plus: true,
        category: 'explicit_18_plus',
        reason: 'Explicit 18+ adult or sexual content is not permitted for live broadcast.',
        refusalMessage: '🚫 Request declined: PromptFM operates under family-safe broadcast standards. Explicit 18+ content is not permitted on air.',
      };
    }
  }

  return {
    safe: true,
    is18Plus: false,
    category: 'clean',
  };
}

/**
 * 2. Deep contextual LLM Safety Evaluation using Gemini 1.5 Flash.
 * Analyzes intent, nuance, and subversive circumvention attempts.
 */
export async function evaluateContentSafety(text: string): Promise<GuardrailResult> {
  // First run fast heuristic check
  const fastResult = evaluateHeuristicGuardrails(text);
  if (!fastResult.safe) {
    return fastResult;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fastResult; // Safe fallback if no API key is set
  }

  const prompt = `You are the Broadcast Standards & Practices Safety Officer for PromptFM, a family-safe and community-inclusive AI radio station.
Carefully inspect this listener submission, song prompt, or dedication for broadcast compliance:
"${text}"

Evaluate against our 4 strict Station Broadcast Rules:
1. RELIGIOUS RESPECT: Absolutely refuse any mockery, hatred, vilification, or defamation targeting religion, religious groups, faith, prophets, or sacred beliefs.
2. ETHICAL & HATE SPEECH: Refuse slurs, hate speech, racism, xenophobia, misogyny, targeted harassment, or threats.
3. 18+ ADULT CONTENT: Refuse sexually explicit, pornographic, or graphic adult material.
4. VIOLENCE & SELF-HARM: Refuse incitement to violence, terrorism, or self-harm.

Respond ONLY with valid JSON in this exact structure:
{
  "safe": true,
  "is_18_plus": false,
  "category": "clean",
  "reason": null,
  "refusal_message": null
}

Or if it violates:
{
  "safe": false,
  "is_18_plus": true,
  "category": "religious_hostility" | "explicit_18_plus" | "hate_speech" | "harassment" | "violence",
  "reason": "Brief explanation of the violation",
  "refusal_message": "Polite broadcast refusal starting with 🚫 explaining why it cannot air"
}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 250,
        },
      }),
    });

    if (!res.ok) {
      return fastResult;
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const parsed = JSON.parse(rawText);

    return {
      safe: parsed.safe !== false,
      is18Plus: Boolean(parsed.is_18_plus),
      category: parsed.category || 'clean',
      reason: parsed.reason || undefined,
      refusalMessage: parsed.refusal_message || undefined,
    };
  } catch (e) {
    console.warn('Gemini safety evaluation error, using heuristic filter:', e);
    return fastResult;
  }
}

