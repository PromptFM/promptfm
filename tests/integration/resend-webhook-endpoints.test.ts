// tests/integration/resend-webhook-endpoints.test.ts
// Integration tests for Resend Webhook Endpoints (Issue #115)
// Ensures neither /api/webhooks/resend nor /api/webhooks/resend/inbound
// write inbound email rows into community_requests as type: 'song'.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as resendWebhookPOST } from '@/app/api/webhooks/resend/route';
import { POST as resendInboundPOST } from '@/app/api/webhooks/resend/inbound/route';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockImplementation((table: string) => ({
  insert: mockInsert,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/email/receiving', () => ({
  forwardInboundEmail: vi.fn().mockResolvedValue(true),
  getReceivedEmail: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id,
      from: 'partner@music.com',
      to: ['dev@promptfm.live'],
      subject: 'Licensing partnership inquiry',
      text: 'We would love to provide music library tracks for your station.',
      html: '<p>We would love to provide music library tracks for your station.</p>',
      createdAt: '2026-11-08T08:00:00Z',
    })
  ),
}));

describe('Resend Webhook Inbound Email Integration (Issue #115)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/webhooks/resend (Official email.received event)', () => {
    it('handles official email.received event and routes to inbound_emails, NOT community_requests', async () => {
      const req = new Request('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email.received',
          data: { email_id: 'rec_email_123' },
        }),
      });

      const res = await resendWebhookPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.emailId).toBe('rec_email_123');

      // Verify community_requests was NEVER touched
      const communityCalls = mockFrom.mock.calls.filter((call) => call[0] === 'community_requests');
      expect(communityCalls).toHaveLength(0);

      // Verify inbound_emails received the record
      const inboundCalls = mockFrom.mock.calls.filter((call) => call[0] === 'inbound_emails');
      expect(inboundCalls).toHaveLength(1);
    });

    it('handles direct legacy payload without inserting into community_requests', async () => {
      const req = new Request('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'alex@example.com',
          to: 'contact@promptfm.live',
          subject: 'Feedback on the new player',
          text: 'The equalizer looks great!',
        }),
      });

      const res = await resendWebhookPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const communityCalls = mockFrom.mock.calls.filter((call) => call[0] === 'community_requests');
      expect(communityCalls).toHaveLength(0);
    });
  });

  describe('POST /api/webhooks/resend/inbound', () => {
    it('routes complaint email to content_reports and inbound_emails, NOT community_requests', async () => {
      const req = new Request('http://localhost:3000/api/webhooks/resend/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'legal@soundcorp.com',
          to: ['legal@promptfm.live'],
          subject: 'DMCA Takedown Notice',
          text: 'Track 12345678-1234-1234-1234-1234567890ab infringes our rights.',
        }),
      });

      const res = await resendInboundPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.category).toBe('complaint');

      const communityCalls = mockFrom.mock.calls.filter((call) => call[0] === 'community_requests');
      expect(communityCalls).toHaveLength(0);

      const reportCalls = mockFrom.mock.calls.filter((call) => call[0] === 'content_reports');
      expect(reportCalls).toHaveLength(1);
    });

    it('routes general listener email to inbound_emails, NOT community_requests', async () => {
      const req = new Request('http://localhost:3000/api/webhooks/resend/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'listener@example.com',
          to: ['contact@promptfm.live'],
          subject: 'Question for DJ Luna',
          text: 'What was that ambient track played at 3 AM?',
        }),
      });

      const res = await resendInboundPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.category).toBe('contact');

      // community_requests MUST NOT receive this!
      const communityCalls = mockFrom.mock.calls.filter((call) => call[0] === 'community_requests');
      expect(communityCalls).toHaveLength(0);

      // inbound_emails MUST receive this!
      const inboundCalls = mockFrom.mock.calls.filter((call) => call[0] === 'inbound_emails');
      expect(inboundCalls).toHaveLength(1);
    });
  });
});

