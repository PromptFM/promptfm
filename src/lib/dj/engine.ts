// src/lib/dj/engine.ts
// AI Radio DJ & News Broadcast Engine
// Generates radio announcements, hourly news bulletins, and track intros
// using Google Gemini Pro and Google Cloud Text-to-Speech.

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getBucketName, getPublicUrl } from '@/lib/r2';
import { randomUUID } from 'crypto';

interface DJScriptOptions {
  type: 'news' | 'track_intro' | 'announcement';
  topicOrText?: string;
  trackTitle?: string;
  artistName?: string;
  toolUsed?: string;
}

/**
 * 1. Calls Google Gemini Pro to generate a lively, punchy radio script.
 */
export async function generateDJScript(options: DJScriptOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  let prompt = '';
  if (options.type === 'news') {
    prompt = `You are DJ Neon, the ultra-charismatic, witty AI host on "PromptFM" — the 24/7 AI-generated music radio station.
Summarize the following headline or topic into a 30-to-45-second energetic radio news flash.
Topic: "${options.topicOrText || 'Latest breakthroughs in generative AI and synthetic music'}"
Rules:
- Speak directly to the listeners with radio enthusiasm.
- Keep it under 75 words.
- Do NOT output stage directions or bracketed text like [music fades]. Only return the spoken script.`;
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
        temperature: 0.8,
        maxOutputTokens: 150,
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
 * 2. Converts script to high-definition MP3 audio using Google Cloud Text-to-Speech.
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
 * 3. End-to-end generator: produces script, voice, uploads MP3 to R2, and returns the public audio URL.
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

