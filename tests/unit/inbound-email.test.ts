// tests/unit/inbound-email.test.ts
// Unit tests for Inbound Email Routing Service (Issue #115)
// Ensures inbound email is routed exclusively to admin handling (inbound_emails & content_reports)
// and never pollutes community_requests or listener queue (/q).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInboundEmail, isEmailRequest } from '@/lib/email/inbound';
import { forwardInboundEmail } from '@/lib/email/receiving';

const mockInsert = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  return {
    insert: mockInsert.mockImplementation((data: unknown) => {
      return Promise.resolve({ data, error: null });
    }),
  };
});

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: vi.fn().mockImplementation(() => ({
      from: mockFrom,
    })),
  };
});

vi.mock('@/lib/email/receiving', () => {
  return {
    forwardInboundEmail: vi.fn().mockResolvedValue(true),
    getReceivedEmail: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        id,
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'General feedback',
        text: 'Love the stream!',
        html: '<p>Love the stream!</p>',
        createdAt: '2026-11-08T00:00:00Z',
      })
    ),
  };
});

describe('Inbound Email Routing Service (Issue #115)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_CONTACT_EMAIL;
  });

  describe('isEmailRequest helper', () => {
    it('detects inbound email prefix patterns in request content', () => {
      expect(isEmailRequest({ content: '[Inbound Resend] To: dev@promptfm.live | Hello' })).toBe(true);
      expect(isEmailRequest({ content: '[Inbound Email] DMCA notice: please review' })).toBe(true);
      expect(isEmailRequest({ content: '  [inbound] Inquiry from partner  ' })).toBe(true);
      expect(isEmailRequest({ content: '[inbound resend] some text' })).toBe(true);
      expect(isEmailRequest({ content: '[inbound email] another text' })).toBe(true);
    });

    it('detects email addresses in platform_user_id with To: header marker', () => {
      expect(
        isEmailRequest({
          platform_user_id: 'alice@example.com',
          content: 'To: contact@promptfm.live | Random text',
        })
      ).toBe(true);
    });

    it('detects email addresses in platform_user_id with Subject: header marker', () => {
      expect(
        isEmailRequest({
          platform_user_id: 'alice@example.com',
          content: 'Subject: Feedback on music',
        })
      ).toBe(true);
    });

    it('returns false when platform_user_id is not an email even if content contains To:', () => {
      expect(
        isEmailRequest({
          platform_user_id: 'discord_listener_42',
          content: 'I want to say To: Sarah Happy Birthday',
        })
      ).toBe(false);
    });

    it('returns false for legitimate community song and dedication requests', () => {
      expect(isEmailRequest({ content: 'synthwave cyberpunk neon vibes' })).toBe(false);
      expect(isEmailRequest({ content: 'Happy birthday to Sarah!', platform_user_id: 'discord_123' })).toBe(false);
      expect(isEmailRequest({ content: 'Tokyo weather' })).toBe(false);
    });

    it('handles empty, non-string, or missing request safely', () => {
      expect(isEmailRequest(null)).toBe(false);
      expect(isEmailRequest(undefined)).toBe(false);
      expect(isEmailRequest('not-an-object' as unknown as { content?: string })).toBe(false);
      expect(isEmailRequest({})).toBe(false);
      expect(isEmailRequest({ content: '' })).toBe(false);
      expect(isEmailRequest({ content: null })).toBe(false);
      expect(isEmailRequest({ content: 123 as unknown as string })).toBe(false);
      expect(isEmailRequest({ platform_user_id: null, content: 'just words' })).toBe(false);
    });
  });

  describe('handleInboundEmail routing', () => {
    it('routes legal/DMCA/complaint email to content_reports and inbound_emails, NEVER to community_requests', async () => {
      const result = await handleInboundEmail({
        from: 'legal@recordlabel.example',
        to: ['complaints@promptfm.live'],
        subject: 'DMCA Takedown Notice for Track 7dd1c716-1234-5678-90ab-cdef12345678',
        text: 'Please remove track 7dd1c716-1234-5678-90ab-cdef12345678 immediately.',
        emailId: 'resend_email_001',
      });

      expect(result.success).toBe(true);
      expect(result.category).toBe('complaint');
      expect(result.message).toBe('Inbound complaint registered into moderation queue');
      expect(result.reportId).toMatch(/^email-[0-9a-f]{8}$/);

      // Verify community_requests was NEVER touched
      const communityCalls = mockFrom.mock.calls.filter((call) => call[0] === 'community_requests');
      expect(communityCalls).toHaveLength(0);

      // Verify content_reports was inserted
      const contentReportCalls = mockFrom.mock.calls.filter((call) => call[0] === 'content_reports');
      expect(contentReportCalls).toHaveLength(1);

      // Verify inbound_emails was inserted with forwarded status and complaint category
      const inboundEmailCalls = mockFrom.mock.calls.filter((call) => call[0] === 'inbound_emails');
      expect(inboundEmailCalls).toHaveLength(1);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          resend_id: 'resend_email_001',
          from_address: 'legal@recordlabel.example',
          to_addresses: ['complaints@promptfm.live'],
          category: 'complaint',
          status: 'forwarded',
        })
      );
    });

    it('routes normal listener inquiry/contact email to inbound_emails and forwards to admin, NEVER to community_requests', async () => {
      const result = await handleInboundEmail({
        from: 'fan@example.com',
        to: ['contact@promptfm.live'],
        subject: 'Question about broadcast schedule',
        text: 'When is DJ Neon on air next?',
        emailId: 'resend_email_002',
      });

      expect(result.success).toBe(true);
      expect(result.category).toBe('contact');
      expect(result.message).toBe('Inbound listener inquiry registered for admin handling');

      const communityCalls = mockFrom.mock.calls.filter((call) => call[0] === 'community_requests');
      expect(communityCalls).toHaveLength(0);

      const inboundEmailCalls = mockFrom.mock.calls.filter((call) => call[0] === 'inbound_emails');
      expect(inboundEmailCalls).toHaveLength(1);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          resend_id: 'resend_email_002',
          from_address: 'fan@example.com',
          to_addresses: ['contact@promptfm.live'],
          subject: 'Question about broadcast schedule',
          category: 'contact',
          status: 'forwarded',
        })
      );

      const contentReportCalls = mockFrom.mock.calls.filter((call) => call[0] === 'content_reports');
      expect(contentReportCalls).toHaveLength(0);
    });

    it('extracts track UUID target from subject or body for DMCA complaints', async () => {
      const trackId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      await handleInboundEmail({
        from: 'artist@indielabel.org',
        to: ['legal@promptfm.live'],
        subject: 'Copyright complaint',
        text: `Unauthorized use in track ${trackId}`,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          target_type: 'track',
          target_id: trackId,
          reason: 'copyright_dmca',
          reporter_platform: 'web',
          reporter_id: 'artist@indielabel.org',
          status: 'pending',
        })
      );
    });

    it('routes non-track complaints to broadcast target_type with fallback target_id and other reason', async () => {
      const subject = 'Harassment and abuse report regarding host commentary';
      await handleInboundEmail({
        from: 'moderator@external.org',
        to: ['abuse@promptfm.live'],
        subject,
        text: 'The host commentary at 14:00 contained harassment.',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          target_type: 'broadcast',
          target_id: `inbound-email-${subject.slice(0, 40)}`,
          reason: 'other',
          reporter_platform: 'web',
          status: 'pending',
        })
      );
    });

    it('truncates complaint details to 2000 characters and sets exact content', async () => {
      const longBody = 'A'.repeat(2500);
      await handleInboundEmail({
        from: 'claimant@example.com',
        to: ['legal@promptfm.live'],
        subject: 'Copyright infringement notice',
        text: longBody,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: `[Inbound Email from claimant@example.com]\nSubject: Copyright infringement notice\n\n${'A'.repeat(2000)}`,
        })
      );
    });

    it('trims leading and trailing whitespace from subjects', async () => {
      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: '   Whitespace in title   ',
        text: 'Hello there',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Whitespace in title',
        })
      );
    });

    it('falls back to html when text is empty string', async () => {
      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'Empty text test',
        text: '',
        html: '<p>Only HTML</p>',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          text_body: '',
          html_body: '<p>Only HTML</p>',
        })
      );
    });

    it('sets null for text_body and html_body when omitted or non-string', async () => {
      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'No body',
        text: undefined,
        html: undefined,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          text_body: null,
          html_body: null,
        })
      );
    });

    it('handles dmca recipient keyword properly', async () => {
      const result = await handleInboundEmail({
        from: 'rights@music.com',
        to: ['dmca@promptfm.live'],
        subject: 'Notice regarding sound recording',
        text: 'Please take down this content.',
      });
      expect(result.category).toBe('complaint');
    });

    it('handles legal recipient keyword properly', async () => {
      const result = await handleInboundEmail({
        from: 'attorney@lawfirm.com',
        to: ['legal@promptfm.live'],
        subject: 'Formal notice',
        text: 'We represent the copyright owner.',
      });
      expect(result.category).toBe('complaint');
    });

    it('handles subject keywords for complaint (infringe, violation, harass)', async () => {
      const res1 = await handleInboundEmail({
        from: 'user@test.com',
        to: ['info@promptfm.live'],
        subject: 'Possible copyright infringe issue',
        text: 'Please check.',
      });
      expect(res1.category).toBe('complaint');

      const res2 = await handleInboundEmail({
        from: 'user@test.com',
        to: ['info@promptfm.live'],
        subject: 'Reporting terms violation',
        text: 'Details inside.',
      });
      expect(res2.category).toBe('complaint');
    });

    it('defaults empty or whitespace subject to No Subject', async () => {
      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['dev@promptfm.live'],
        subject: '   ',
        text: 'Message body without subject',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'No Subject',
        })
      );

      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['dev@promptfm.live'],
        subject: null,
        text: 'Another message',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'No Subject',
        })
      );
    });

    it('handles html-only emails properly when text is null', async () => {
      await handleInboundEmail({
        from: 'designer@promptfm.live',
        to: ['contact@promptfm.live'],
        subject: 'HTML newsletter',
        text: null,
        html: '<div>Rich HTML content</div>',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          text_body: null,
          html_body: '<div>Rich HTML content</div>',
        })
      );
    });

    it('handles text-only emails properly when html is null', async () => {
      await handleInboundEmail({
        from: 'texter@promptfm.live',
        to: ['contact@promptfm.live'],
        subject: 'Plain text update',
        text: 'Plain text only',
        html: null,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          text_body: 'Plain text only',
          html_body: null,
        })
      );
    });

    it('handles custom ADMIN_CONTACT_EMAIL environment variable', async () => {
      process.env.ADMIN_CONTACT_EMAIL = 'custom-admin@station.fm';

      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['dev@promptfm.live'],
        subject: 'Custom admin test',
        text: 'Testing custom admin recipient.',
      });

      expect(forwardInboundEmail).toHaveBeenCalledWith(
        expect.anything(),
        'custom-admin@station.fm'
      );
    });

    it('falls back to default admin address when ADMIN_CONTACT_EMAIL is unset', async () => {
      delete process.env.ADMIN_CONTACT_EMAIL;

      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['dev@promptfm.live'],
        subject: 'Default admin test',
        text: 'Testing fallback.',
      });

      expect(forwardInboundEmail).toHaveBeenCalledWith(
        expect.anything(),
        'trifan.alex.criss@gmail.com'
      );
    });

    it('sets status to received when forwardInboundEmail returns false', async () => {
      vi.mocked(forwardInboundEmail).mockResolvedValueOnce(false);

      const result = await handleInboundEmail({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'Failed forward test',
        text: 'Mail service unavailable',
      });

      expect(result.forwarded).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'received',
        })
      );
    });

    it('handles forwardInboundEmail throwing an exception gracefully', async () => {
      vi.mocked(forwardInboundEmail).mockRejectedValueOnce(new Error('Resend network timeout'));

      const result = await handleInboundEmail({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'Network throw test',
        text: 'Mail service timeout',
      });

      expect(result.success).toBe(true);
      expect(result.forwarded).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'received',
        })
      );
    });

    it('sets resend_id to null when emailId is omitted or null', async () => {
      await handleInboundEmail({
        from: 'listener@example.com',
        to: ['contact@promptfm.live'],
        subject: 'No ID email',
        text: 'Direct payload without resend ID',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          resend_id: null,
        })
      );
    });

    it('handles string to address or fallback when to is undefined', async () => {
      await handleInboundEmail({
        from: 'listener@example.com',
        to: undefined as unknown as string[],
        subject: 'Undefined to',
        text: 'Checking fallback to',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          to_addresses: ['dev@promptfm.live'],
        })
      );
    });

    it('gracefully completes even if database insert fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database offline'));

      const result = await handleInboundEmail({
        from: 'listener@example.com',
        to: ['dev@promptfm.live'],
        subject: 'Site feedback',
        text: 'Nice UI redesign!',
      });

      expect(result.success).toBe(true);
      expect(result.forwarded).toBe(true);
    });

    it('treats mail to report@ and legal@ as a complaint and forwards it', async () => {
      for (const to of ['report@promptfm.live', 'legal@promptfm.live']) {
        mockInsert.mockClear();
        const result = await handleInboundEmail({ from: 'x@example.com', to: [to], subject: 'Hello', text: 'please look' });
        expect(result.category).toBe('complaint');
        expect(result.forwarded).toBe(true);
        expect(mockFrom).toHaveBeenCalledWith('content_reports');
      }
    });

    it('treats mail to dev@ and contact@ as contact, not a complaint', async () => {
      for (const to of ['dev@promptfm.live', 'contact@promptfm.live']) {
        const result = await handleInboundEmail({ from: 'x@example.com', to: [to], subject: 'Hello', text: 'hi' });
        expect(result.category).toBe('contact');
      }
    });
  });
});
