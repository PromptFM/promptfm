// src/app/api/scan-lyrics/route.ts
// Automated AI Lyric & Audio Scan (Gemini 3.5 Flash & 0-Token Heuristic)
// Enforces child-safety, family-friendly tagging, profanity detection, and channel restrictions.

import { NextRequest, NextResponse } from 'next/server';
import { scanLyricsAndContent } from '@/lib/safety/lyric-scanner';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, lyrics, description } = body as {
      title?: string;
      lyrics?: string;
      description?: string;
    };

    const scan = await scanLyricsAndContent({
      title: title || '',
      lyrics: lyrics || undefined,
      description: description || undefined,
    });

    return NextResponse.json({ scan });
  } catch (err) {
    console.error('Error scanning lyrics:', err);
    return NextResponse.json(
      { error: 'Failed to scan lyrics and audio content' },
      { status: 500 }
    );
  }
}
