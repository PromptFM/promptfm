// tests/integration/contact-api.test.ts
// Integration tests for POST /api/contact

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/contact/route';

vi.mock('@/lib/email/resend', () => ({
  sendContactEmail: vi.fn().mockImplementation(async (payload) => {
    return { success: true, id: 'test-email-msg-456' };
  }),
}));

describe('POST /api/contact Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests with missing required fields', async () => {
    const req = new Request('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('rejects invalid email formats', async () => {
    const req = new Request('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex',
        email: 'invalid-email',
        subject: 'Inquiry',
        message: 'Hello station team',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Valid email address is required');
  });

  it('successfully delivers message and returns messageId', async () => {
    const req = new Request('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Listener Alex',
        email: 'alex@example.com',
        subject: 'Track Feedback',
        message: 'Great track rotation this morning!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.messageId).toBe('test-email-msg-456');
  });
});
