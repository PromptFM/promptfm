// tests/integration/admin-requests-api.test.ts
// Integration test for Admin Requests API endpoint auth & management

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/requests/route';

let mockDbData: Array<{ id: string; platform: string; status: string }> | null = [
  {
    id: 'req_1',
    platform: 'discord',
    status: 'pending',
  },
];
let mockDbError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => ({
              data: mockDbData,
              error: mockDbError,
            })),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock('@/lib/dj/batches', () => ({
  rejectScheduledRequest: vi.fn().mockImplementation(async (_id: string, reason: string, moderator: string) => ({
    success: true,
    action: 'rejected',
    recordedReason: reason,
    recordedModerator: moderator,
  })),
  synthesizeScheduledRequest: vi.fn().mockResolvedValue({ audioUrl: 'http://cdn/req.mp3' }),
  synthesizeBatchAnnouncement: vi.fn().mockResolvedValue({ audioUrl: 'http://cdn/batch.mp3' }),
}));

const TEST_ADMIN_KEY = 'requests-admin-key-555';

describe('Admin Requests API (/api/admin/requests)', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    mockDbData = [
      {
        id: 'req_1',
        platform: 'discord',
        status: 'pending',
      },
    ];
    mockDbError = null;
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAdminKey !== undefined) {
      process.env.ADMIN_API_KEY = originalAdminKey;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
  });

  it('rejects GET requests without credentials when ADMIN_API_KEY is configured', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('accepts GET requests with valid x-admin-key header', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      headers: { 'x-admin-key': TEST_ADMIN_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requests).toBeDefined();
    expect(json.requests.length).toBe(1);
  });

  it('handles GET requests when database query fails with 500', async () => {
    mockDbError = { message: 'Database connection failed' };
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      headers: { 'x-admin-key': TEST_ADMIN_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Database connection failed');
  });

  it('returns empty array if database returns null data on GET', async () => {
    mockDbData = null;
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      headers: { 'x-admin-key': TEST_ADMIN_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requests).toEqual([]);
  });

  it('rejects POST requests without credentials when ADMIN_API_KEY is configured', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'air', requestId: 'req_1' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('accepts POST requests with valid authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${TEST_ADMIN_KEY}`,
      },
      body: JSON.stringify({ action: 'air', requestId: 'req_1' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('handles air_batch action successfully when batchId is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ action: 'air_batch', batchId: 'batch_42' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.audioUrl).toBe('http://cdn/batch.mp3');
  });

  it('rejects air_batch action with 400 when batchId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ action: 'air_batch' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing batchId');
  });

  it('rejects request with 400 when requestId is missing for non-batch actions', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ action: 'reject' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing requestId');
  });

  it('handles reject action with custom reason and moderator', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({
        action: 'reject',
        requestId: 'req_1',
        reason: 'Violates TOS',
        moderator: 'Admin DJ',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recordedReason).toBe('Violates TOS');
    expect(json.recordedModerator).toBe('Admin DJ');
  });

  it('handles remove action falling back to default reason and moderator', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({
        action: 'remove',
        requestId: 'req_1',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recordedReason).toBe('Declined by broadcast standards & practices');
    expect(json.recordedModerator).toBe('Station Director');
  });

  it('handles air action successfully', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({
        action: 'air',
        requestId: 'req_1',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.audioUrl).toBe('http://cdn/req.mp3');
  });

  it('handles reject action with empty reason falling back to default standards reason', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({
        action: 'reject',
        requestId: 'req_1',
        reason: '',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recordedReason).toBe('Declined by broadcast standards & practices');
    expect(json.recordedModerator).toBe('Station Director');
  });

  it('rejects unknown action with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({
        action: 'unsupported_action',
        requestId: 'req_1',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid action');
  });

  it('handles unexpected exceptions returning 500 status', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY,
      },
      body: 'invalid-json{',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
