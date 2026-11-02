// tests/integration/upload-url.test.ts
// Integration test for POST /api/upload-url (supports .mp3, .mp4, .m4a, and .wav)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let mockUser: { id: string; email: string } | null = { id: 'usr_test_123', email: 'test@promptfm.live' };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUser },
        error: mockUser ? null : new Error('No session'),
      })),
    },
  })),
}));

vi.mock('@/lib/r2', () => ({
  getBucketName: vi.fn(() => 'promptfm-tracks-mock'),
  getPublicUrl: vi.fn((key: string) => `https://r2.promptfm.live/${key}`),
  getR2Client: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://mock-presigned-url.r2.cloudflarestorage.com/upload'),
}));

import { POST } from '@/app/api/upload-url/route';

describe('POST /api/upload-url API Integration', () => {
  beforeEach(() => {
    mockUser = { id: 'usr_test_123', email: 'test@promptfm.live' };
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockUser = null;

    const req = new NextRequest('http://localhost:3000/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: 'test.mp3', contentType: 'audio/mpeg' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('accepts MP3 files and returns a key ending in .mp3', async () => {
    const req = new NextRequest('http://localhost:3000/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: 'Born to Break.mp3', contentType: 'audio/mpeg' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.presignedUrl).toBeDefined();
    expect(json.key).toMatch(/^tracks\/usr_test_123\/[a-f0-9-]+\.mp3$/);
    expect(json.publicUrl).toBe(`https://r2.promptfm.live/${json.key}`);
  });

  it('accepts MP4 audio/video container files and returns a key ending in .mp4', async () => {
    const req = new NextRequest('http://localhost:3000/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: 'forged_in_pain.mp3.MP4', contentType: 'video/mp4' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.presignedUrl).toBeDefined();
    expect(json.key).toMatch(/^tracks\/usr_test_123\/[a-f0-9-]+\.mp4$/);
    expect(json.publicUrl).toBe(`https://r2.promptfm.live/${json.key}`);
  });

  it('accepts audio/mp4 content type and returns a key ending in .mp4', async () => {
    const req = new NextRequest('http://localhost:3000/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: 'song.mp4', contentType: 'audio/mp4' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.key).toMatch(/\.mp4$/);
  });

  it('rejects unsupported file formats like image/png with 415', async () => {
    const req = new NextRequest('http://localhost:3000/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: 'photo.png', contentType: 'image/png' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(415);
  });
});
