// src/lib/dj/engine.ts
// AI Radio DJ & News Broadcast Engine
// Generates radio announcements, hourly news bulletins, and track intros
// using Google Gemini Pro and Google Cloud Text-to-Speech.

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getBucketName, getPublicUrl } from '../r2';
import { randomUUID } from 'crypto';

interface DJScriptOptions {
  type: 'news' | 'track_intro' | 'announcement' | 'custom_prompt';
  topicOrText?: string;
  customSystemPrompt?: string;
  headlines?: string[];
  trackTitle?: string;
  artistName?: string;
  toolUsed?: string;
}

/**
 * 1. Fetches real-time live tech/AI headlines from public RSS/news feeds.
 * Free, requires zero API keys.
 */
export async function fetchLiveHeadlines(
  feedUrls: string[] = [
    'https://hnrss.org/frontpage?q=AI+OR+music+OR+model',
    'https://news.google.com/rss/search?q=generative+AI+music&hl=en-US&gl=US&ceid=US:en',
  ]
): Promise<string[]> {
  const allHeadlines: string[] = [];

  for (const url of feedUrls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PromptFM-Radio/1.0' }, next: { revalidate: 300 } });
      if (!res.ok) continue;
      const text = await res.text();

      // Extract item titles from RSS XML
      const itemMatches = [...text.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gi)];
      for (const m of itemMatches) {
        const title = m[1]?.trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        if (title && !title.toLowerCase().includes('rss') && title.length > 10) {
          allHeadlines.push(title);
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch news feed ${url}:`, e);
    }
  }

  // Deduplicate and return top 8 fresh headlines
  return Array.from(new Set(allHeadlines)).slice(0, 8);
}

/**
 * 2. Calls Google Gemini to generate a live script based on your custom prompt or live headlines.
 */
export async function generateDJScript(options: DJScriptOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  let prompt = '';

  if (options.type === 'custom_prompt') {
    // Direct arbitrary prompt from the CLI or admin
    prompt = `You are DJ Neon, the witty, energetic radio host on PromptFM (the 24/7 AI music station).
Listener/Admin Instruction: "${options.topicOrText}"
Rules:
- Speak directly to listeners in a punchy radio broadcast style.
- Keep it under 60 words.
- Do NOT output stage directions or bracketed text like [music fades]. Only return the spoken words.`;
  } else if (options.type === 'news') {
    const rawHeadlines = options.headlines && options.headlines.length > 0
      ? options.headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
      : 'Top generative audio models Suno, Udio, and Stable Audio continue to trend.';

    prompt = `You are DJ Neon on PromptFM. Here are the latest live headlines:
${rawHeadlines}

Task: Pick the 2 most interesting stories and deliver an energetic, snappy 40-second radio news flash.
Specific angle requested: "${options.topicOrText || 'AI and synthetic music landscape'}"
Rules:
- Speak with radio charisma.
- Keep it under 80 words.
- No stage directions or brackets. Only return the exact spoken script.`;
  } else if (options.type === 'track_intro') {
    prompt = `You are DJ Neon on PromptFM. Give a 10-second hype intro for an upcoming track.
Track: "${options.trackTitle}" by artist "${options.artistName}", created with ${options.toolUsed || 'AI'}.
Rules: Under 30 words. No stage directions. Only the spoken words.`;
  } else {
    prompt = `You are DJ Neon on PromptFM. Deliver this announcement to your listeners with high-energy radio flair: "${options.topicOrText}". Under 40 words. No bracketed cues.`;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 200,
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Gemini API error: ${errorData}`);
  }

  const data = await res.json();
  const script = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return script;
}

/**
 * 3. Converts script to high-definition MP3 audio using Google Cloud Text-to-Speech.
 */
export async function synthesizeDJVoice(text: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_TTS_API_KEY or GEMINI_API_KEY.');
  }

  const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Journey-F', // Hyper-realistic Google Journey broadcast voice
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.05,
        pitch: 0.0,
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Google TTS API error: ${errorData}`);
  }

  const data = await res.json();
  const audioContentBase64 = data.audioContent;
  return Buffer.from(audioContentBase64, 'base64');
}

/**
 * 4. End-to-end generator: produces script, voice, uploads MP3 to R2, and returns the public audio URL.
 */
export async function createBroadcastDrop(options: DJScriptOptions): Promise<{ script: string; audioUrl: string }> {
  const script = await generateDJScript(options);
  const audioBuffer = await synthesizeDJVoice(script);

  const key = `interstitials/${options.type}/${randomUUID()}.mp3`;
  const s3 = getR2Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    }),
  );

  return {
    script,
    audioUrl: getPublicUrl(key),
  };
}
