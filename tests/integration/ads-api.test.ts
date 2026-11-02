// tests/integration/ads-api.test.ts
// Integration tests for GET /api/ads and POST /api/ads/event

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/ads/route';

describe('/api/ads API Integration', () => {
  describe('GET /api/ads', () => {
    it('returns active sponsor banners with 200 OK', async () => {
      const req = new Request('https://promptfm.live/api/ads?placement=header_ribbon');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.banners)).toBe(true);
      expect(data.banners.length).toBeGreaterThan(0);
      expect(data.banners[0].sponsor).toBeDefined();
    });

    it('defaults to all active banners when placement is omitted', async () => {
      const req = new Request('https://promptfm.live/api/ads');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.banners.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('POST /api/ads', () => {
    it('records an impression event and returns 200 OK', async () => {
      const req = new Request('https://promptfm.live/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: 'suno_creator', event: 'impression' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats.impressions).toBeGreaterThanOrEqual(1);
    });

    it('rejects an invalid event or missing adId with 400 Bad Request', async () => {
      const req = new Request('https://promptfm.live/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: '', event: 'click' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid adId or event type');
    });

    it('handles malformed JSON body with 400 Bad Request', async () => {
      const req = new Request('https://promptfm.live/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid JSON payload');
    });
  });
});
