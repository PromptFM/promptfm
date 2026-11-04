// tests/unit/resend-receiving.test.ts
// Unit tests for Resend Inbound receiving, listing, and email forwarding

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listReceivedEmails, getReceivedEmail, forwardInboundEmail } from '@/lib/email/receiving';

describe('Resend Receiving Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists received emails from Resend Receiving API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'email_123',
            from: 'noreply@github.com',
            to: ['dev@promptfm.live'],
            subject: '[GitHub] Please verify your email address',
            created_at: '2026-11-04T10:30:00Z',
          },
        ],
      }),
    });

    const emails = await listReceivedEmails('test_api_key');
    expect(emails).toHaveLength(1);
    expect(emails[0]!.id).toBe('email_123');
    expect(emails[0]!.from).toBe('noreply@github.com');
    expect(emails[0]!.to).toContain('dev@promptfm.live');
  });

  it('retrieves detailed content of a received email', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'email_123',
        from: 'noreply@github.com',
        to: ['dev@promptfm.live'],
        subject: '[GitHub] Please verify your email address',
        text: 'Your GitHub verification code is 482910.',
        html: '<p>Your GitHub verification code is <strong>482910</strong>.</p>',
        created_at: '2026-11-04T10:30:00Z',
      }),
    });

    const email = await getReceivedEmail('email_123', 'test_api_key');
    expect(email).not.toBeNull();
    expect(email?.text).toContain('482910');
    expect(email?.html).toContain('<strong>482910</strong>');
  });

  it('forwards an inbound email to the destination address', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'fwd_msg_999' }),
    });

    const success = await forwardInboundEmail(
      {
        id: 'email_123',
        from: 'noreply@github.com',
        to: ['dev@promptfm.live'],
        subject: 'GitHub Verification',
        text: 'Code: 123456',
        createdAt: '2026-11-04T10:30:00Z',
      },
      'admin@gmail.com',
      'test_api_key'
    );

    expect(success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('admin@gmail.com'),
      })
    );
  });
});

