// tests/integration/resend-inbound-webhook.test.ts
// Integration tests for POST /api/webhooks/resend/inbound

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/resend/inbound/route';

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    }),
  };
});

describe('POST /api/webhooks/resend/inbound Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed inbound payloads without sender', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/resend/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Hello' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('records an inbound DMCA/complaint email directly into content_reports', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/resend/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'legal@recordlabel.example',
        to: ['complaints@promptfm.live'],
        subject: 'DMCA Takedown Notice for Track ID 7dd1c716',
        text: 'This track contains unauthorized audio samples from our catalog.',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.category).toBe('complaint');
  });

  it('records an inbound listener inquiry into community requests/feedback', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/resend/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'Song suggestion for DJ Neon',
        text: 'Please play more energetic morning tracks!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.category).toBe('contact');
  });
});

