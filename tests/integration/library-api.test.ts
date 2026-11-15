// tests/integration/library-api.test.ts
// Integration tests for GET /api/library and POST /api/library/queue

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as publicCatalog from '@/lib/library/public-catalog';
import * as songPathway from '@/lib/song/pathway';
import { GET } from '@/app/api/library/route';
import { POST } from '@/app/api/library/queue/route';

describe('GET /api/library and POST /api/library/queue Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/library', () => {
    it('returns catalog items with pagination parameters', async () => {
      const mockTracks = [
        {
          id: 't-1',
          title: 'Neon Horizon',
          artist_name: 'Solaris',
          audio_url: 'https://cdn.example/neon.mp3',
          tool_used: 'Suno',
          status: 'approved',
          upvotes_count: 10,
        },
      ];

      vi.spyOn(publicCatalog, 'fetchApprovedCatalogTracks').mockResolvedValue(mockTracks);

      const req = new NextRequest('http://localhost:3000/api/library?page=1&pageSize=20&q=neon');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.page).toBe(1);
      expect(json.pageSize).toBe(20);
      expect(json.total).toBe(1);
      expect(json.items).toHaveLength(1);
      expect(json.items[0].id).toBe('t-1');
      expect(json.items[0].title).toBe('Neon Horizon');
    });

    it('returns 500 when fetchApprovedCatalogTracks throws', async () => {
      vi.spyOn(publicCatalog, 'fetchApprovedCatalogTracks').mockRejectedValue(new Error('DB failure'));

      const req = new NextRequest('http://localhost:3000/api/library');
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('DB failure');
    });
  });

  describe('POST /api/library/queue', () => {
    it('returns 400 when body is not valid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/library/queue', {
        method: 'POST',
        body: 'invalid-json',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/valid track id/i);
    });

    it('returns 400 when trackId is missing or empty', async () => {
      const req = new NextRequest('http://localhost:3000/api/library/queue', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/track id/i);
    });

    it('successfully queues track and returns 200', async () => {
      vi.spyOn(songPathway, 'queueSong').mockResolvedValue({
        status: 'queued',
        position: 1,
        eta: { position: 1, itemsAhead: 0, waitSeconds: 60, waitMinutes: 1, displayTime: '12:00', batchId: 'BATCH-1', estimatedAirDate: new Date(), formattedETA: '~1 min', isProvisional: false },
        confirmationMessage: 'Queued Neon Horizon',
        isRejected: false,
        requestId: 'req-1',
        queueItemId: 'q-1',
        track: { title: 'Neon Horizon', artist_name: 'Solaris' },
      });

      const req = new NextRequest('http://localhost:3000/api/library/queue', {
        method: 'POST',
        body: JSON.stringify({ trackId: 't-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.trackId).toBe('t-1');
      expect(json.message).toContain('Neon Horizon');
    });

    it('returns 404 when track is not found in approved catalog', async () => {
      vi.spyOn(songPathway, 'queueSong').mockResolvedValue({
        status: 'no_match',
        position: 0,
        eta: { position: 0, itemsAhead: 0, waitSeconds: 0, waitMinutes: 0, displayTime: '', batchId: '', estimatedAirDate: new Date(), formattedETA: '', isProvisional: false },
        confirmationMessage: 'No track found',
        isRejected: false,
      });

      const req = new NextRequest('http://localhost:3000/api/library/queue', {
        method: 'POST',
        body: JSON.stringify({ trackId: 'missing-id' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/not found/i);
    });

    it('returns 400 when queue request is rejected by safety/guardrails', async () => {
      vi.spyOn(songPathway, 'queueSong').mockResolvedValue({
        status: 'rejected',
        position: 0,
        eta: { position: 0, itemsAhead: 0, waitSeconds: 0, waitMinutes: 0, displayTime: '', batchId: '', estimatedAirDate: new Date(), formattedETA: '', isProvisional: false },
        confirmationMessage: 'Request violates guidelines',
        isRejected: true,
        rejectionReason: 'inappropriate',
      });

      const req = new NextRequest('http://localhost:3000/api/library/queue', {
        method: 'POST',
        body: JSON.stringify({ trackId: 'bad-track' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/guidelines/i);
    });

    it('returns 500 when queueSong throws', async () => {
      vi.spyOn(songPathway, 'queueSong').mockRejectedValue(new Error('Queue service failed'));

      const req = new NextRequest('http://localhost:3000/api/library/queue', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({ trackId: 't-error' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Queue service failed');
    });
  });
});
