// tests/integration/admin-broadcast-api.test.ts
// Integration test for Admin Broadcast & Multi-Platform Social Dispatch API

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/broadcast/route';

describe('Admin Broadcast & Social Dispatch API (POST /api/admin/broadcast)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests with missing message body', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Message is required');
  });

  it('dispatches broadcast to Discord, Telegram, and X (Twitter)', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Weekly Chart Update',
        message: 'Top 10 songs on PromptFM live now! Vote at promptfm.live/top',
        postToDiscord: true,
        postToTelegram: true,
        postToX: true,
        url: 'https://promptfm.live/top',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results).toBeDefined();
    expect(json.results.x).toBeDefined();
    expect(json.results.x.success).toBe(true);
  });
});

