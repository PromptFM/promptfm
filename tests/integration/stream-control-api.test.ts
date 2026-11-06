// tests/integration/stream-control-api.test.ts
// Integration tests for POST/GET /api/admin/stream — RTMP stream start/stop/status control.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/stream/route';

vi.mock('@/lib/streaming/rtmp-controller', () => ({
  getStreamStatus: vi.fn().mockResolvedValue({
    sessions: {
      youtube: { platform: 'youtube', status: 'stopped' },
      tiktok: { platform: 'tiktok', status: 'stopped' },
    },
    controllerVersion: '1.0.0',
    icecastUrl: 'http://icecast:8000/stream.mp3',
  }),
  startStream: vi.fn().mockResolvedValue({
    success: true,
    message: 'YouTube stream started',
    session: { platform: 'youtube', status: 'connecting', startedAt: new Date().toISOString() },
  }),
  stopStream: vi.fn().mockResolvedValue({
    success: true,
    message: 'YouTube stream stopped',
    session: { platform: 'youtube', status: 'stopped', stoppedAt: new Date().toISOString() },
  }),
  validateStreamConfig: vi.fn().mockReturnValue({ valid: true }),
}));

const ADMIN_KEY = 'test-admin-key-123';

function makeRequest(method: string, body?: object, adminKey = ADMIN_KEY): NextRequest {
  const headers: Record<string, string> = { 'x-admin-key': adminKey };
  if (body) headers['Content-Type'] = 'application/json';
  return new NextRequest('http://localhost:3000/api/admin/stream', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Admin RTMP Stream Control API (/api/admin/stream)', () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    vi.clearAllMocks();
  });

  describe('GET /api/admin/stream — status query', () => {
    it('returns stream status for all platforms', async () => {
      const req = makeRequest('GET');
      const res = await GET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.sessions).toBeDefined();
      expect(data.sessions.youtube.status).toBe('stopped');
      expect(data.sessions.tiktok.status).toBe('stopped');
    });

    it('returns 401 when admin key is missing', async () => {
      const req = makeRequest('GET', undefined, '');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/stream — start stream', () => {
    it('starts YouTube stream with valid config', async () => {
      const req = makeRequest('POST', {
        action: 'start',
        platform: 'youtube',
        streamKey: 'xxxx-yyyy-zzzz-aaaa',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.session.platform).toBe('youtube');
    });

    it('starts TikTok stream with rtmpUrl override', async () => {
      const req = makeRequest('POST', {
        action: 'start',
        platform: 'tiktok',
        streamKey: 'tiktok-key-abc',
        rtmpUrl: 'rtmp://push-rtmp-f.tiktok.com/app',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('stops a stream when action is stop', async () => {
      const req = makeRequest('POST', { action: 'stop', platform: 'youtube' });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('returns 400 for missing platform', async () => {
      const req = makeRequest('POST', { action: 'start', streamKey: 'yt-key' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid action', async () => {
      const req = makeRequest('POST', { action: 'nuke', platform: 'youtube' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing streamKey on start', async () => {
      const req = makeRequest('POST', { action: 'start', platform: 'youtube' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 401 when admin key is wrong', async () => {
      const req = makeRequest('POST', { action: 'start', platform: 'youtube', streamKey: 'k' }, 'wrong-key');
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});

