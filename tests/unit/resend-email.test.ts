// tests/unit/resend-email.test.ts
// Unit tests for PromptFM Resend Email service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendContactEmail,
  sendContentReportAlert,
  sendSubmissionStatusEmail,
  getResendClient,
} from '@/lib/email/resend';

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: vi.fn().mockResolvedValue({
          data: { id: 'mock-email-123' },
          error: null,
        }),
      };
    },
  };
});

describe('Resend Email Integration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
  });

  it('handles sending in dev/fallback mode when RESEND_API_KEY is not configured', async () => {
    const result = await sendContactEmail({
      name: 'Alex Listener',
      email: 'alex@example.com',
      subject: 'Great station vibes!',
      message: 'Loving the AI synth stream on promptfm.live',
    });

    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('sends contact email via Resend when API key is set', async () => {
    process.env.RESEND_API_KEY = 're_test_12345';
    const result = await sendContactEmail({
      name: 'DJ Fan',
      email: 'fan@example.com',
      subject: 'Song Request',
      message: 'Can you play more synthwave?',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('mock-email-123');
  });

  it('sends content report alert email to station moderators', async () => {
    process.env.RESEND_API_KEY = 're_test_12345';
    process.env.ADMIN_EMAIL = 'moderation@promptfm.live';

    const result = await sendContentReportAlert({
      id: 'rep-uuid-999',
      target_type: 'track',
      target_id: 'track-uuid-111',
      reason: 'copyright_dmca',
      details: 'Infringes on registered melody',
      reporter_platform: 'web',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('mock-email-123');
  });

  it('sends track submission status notification to submitter', async () => {
    process.env.RESEND_API_KEY = 're_test_12345';

    const result = await sendSubmissionStatusEmail({
      recipientEmail: 'artist@example.com',
      trackTitle: 'Synthetic Dawn',
      artistName: 'CyberArtist',
      status: 'approved',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('mock-email-123');
  });
});
