// tests/unit/resend-email.test.ts
// Comprehensive unit tests for PromptFM Resend Email service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendContactEmail,
  sendContentReportAlert,
  sendSubmissionStatusEmail,
  getResendClient,
  resetResendClientForTesting,
  getSenderEmail,
  getStationInbox,
} from '@/lib/email/resend';

const mockSend = vi.fn();

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      apiKey: string;
      constructor(key: string) {
        this.apiKey = key;
      }
      emails = {
        send: mockSend,
      };
    },
  };
});

describe('Resend Email Integration Service', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    resetResendClientForTesting();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.ADMIN_EMAIL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    resetResendClientForTesting();
  });

  describe('Configuration & Client Initialization', () => {
    it('returns null if RESEND_API_KEY is not set or empty', () => {
      expect(getResendClient()).toBeNull();
      process.env.RESEND_API_KEY = '   ';
      expect(getResendClient()).toBeNull();
    });

    it('returns a Resend client and caches it when valid API key is present', () => {
      process.env.RESEND_API_KEY = 're_test_123';
      const client1 = getResendClient();
      expect(client1).not.toBeNull();
      const client2 = getResendClient();
      expect(client2).toBe(client1);

      // New client when key changes
      process.env.RESEND_API_KEY = 're_test_456';
      const client3 = getResendClient();
      expect(client3).not.toBe(client1);
    });

    it('resolves sender email and station inbox from env or defaults', () => {
      expect(getSenderEmail()).toBe('PromptFM Radio <contact@promptfm.live>');
      expect(getStationInbox()).toBe('station@promptfm.live');

      process.env.EMAIL_FROM = 'Custom Sender <sender@promptfm.live>';
      process.env.ADMIN_EMAIL = 'custom-inbox@promptfm.live';

      expect(getSenderEmail()).toBe('Custom Sender <sender@promptfm.live>');
      expect(getStationInbox()).toBe('custom-inbox@promptfm.live');
    });
  });

  describe('sendContactEmail', () => {
    it('handles sending in dev/fallback mode when RESEND_API_KEY is not configured', async () => {
      const result = await sendContactEmail({
        name: 'Alex Listener',
        email: 'alex@example.com',
        subject: 'Great station vibes!',
        message: 'Loving the AI synth stream on promptfm.live',
      });

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.id).toMatch(/^dev-/);
    });

    it('sends contact email via Resend and escapes HTML characters', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockResolvedValueOnce({
        data: { id: 'email_id_999' },
        error: null,
      });

      const result = await sendContactEmail({
        name: '<script>alert("hack")</script>',
        email: 'hacker@example.com',
        subject: '<b>Bug</b>',
        message: '<img src=x onerror=alert(1)> Hello PromptFM',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('email_id_999');

      const callArgs = mockSend.mock.calls[0]![0];
      expect(callArgs.to).toEqual(['station@promptfm.live']);
      expect(callArgs.replyTo).toBe('hacker@example.com');
      expect(callArgs.subject).toBe('[PromptFM Contact] <b>Bug</b>');
      expect(callArgs.html).toContain('&lt;script&gt;');
      expect(callArgs.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('handles Resend API error response gracefully', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid API key or rate limit reached' },
      });

      const result = await sendContactEmail({
        name: 'Listener',
        email: 'listener@example.com',
        subject: 'Hi',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key or rate limit reached');
    });

    it('handles network exceptions gracefully', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockRejectedValueOnce(new Error('Network timeout connecting to api.resend.com'));

      const result = await sendContactEmail({
        name: 'Listener',
        email: 'listener@example.com',
        subject: 'Hi',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout connecting to api.resend.com');
    });

    it('handles non-Error thrown exceptions', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockRejectedValueOnce('Unknown failure string');

      const result = await sendContactEmail({
        name: 'Listener',
        email: 'listener@example.com',
        subject: 'Hi',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown failure string');
    });
  });

  describe('sendContentReportAlert', () => {
    it('handles dev/fallback mode when RESEND_API_KEY is not configured', async () => {
      const result = await sendContentReportAlert({
        id: 'rep_123',
        target_type: 'track',
        target_id: 'trk_abc',
        reason: 'copyright_dmca',
        details: 'Unauthorized copy',
        reporter_platform: 'web',
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.id).toBe('dev-rep-rep_123');
    });

    it('sends moderation alert with custom admin email and default statement when details empty', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      process.env.ADMIN_EMAIL = 'moderation-board@promptfm.live';

      mockSend.mockResolvedValueOnce({
        data: { id: 'alert_email_555' },
        error: null,
      });

      const result = await sendContentReportAlert({
        id: 'rep_999',
        target_type: 'track',
        target_id: 'trk_999',
        reason: 'hate_harassment',
        details: '',
        reporter_platform: 'discord',
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('alert_email_555');

      const callArgs = mockSend.mock.calls[0]![0];
      expect(callArgs.to).toEqual(['moderation-board@promptfm.live']);
      expect(callArgs.subject).toContain('⚠️ [MODERATION ALERT] HATE_HARASSMENT on track');
      expect(callArgs.html).toContain('No additional details provided.');
    });

    it('handles Resend API error response in moderation alert', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Daily quota exceeded' },
      });

      const result = await sendContentReportAlert({
        id: 'rep_err',
        target_type: 'track',
        target_id: 'trk_err',
        reason: 'spam_abuse',
        details: 'Spam track',
        reporter_platform: 'mcp',
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Daily quota exceeded');
    });

    it('handles exceptions in sendContentReportAlert', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockRejectedValueOnce(new Error('Connection aborted'));

      const result = await sendContentReportAlert({
        id: 'rep_err2',
        target_type: 'track',
        target_id: 'trk_err2',
        reason: 'other',
        details: 'Other issue',
        reporter_platform: 'telegram',
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection aborted');
    });
  });

  describe('sendSubmissionStatusEmail', () => {
    it('handles dev/fallback mode when RESEND_API_KEY is not configured', async () => {
      const result = await sendSubmissionStatusEmail({
        recipientEmail: 'artist@example.com',
        trackTitle: 'Synthetic Horizon',
        artistName: 'SynthDJ',
        status: 'approved',
      });

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
    });

    it('sends approved submission notification email', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockResolvedValueOnce({
        data: { id: 'status_email_777' },
        error: null,
      });

      const result = await sendSubmissionStatusEmail({
        recipientEmail: 'artist@example.com',
        trackTitle: 'Neon Waves',
        artistName: 'CyberArtist',
        status: 'approved',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('status_email_777');

      const callArgs = mockSend.mock.calls[0]![0];
      expect(callArgs.to).toEqual(['artist@example.com']);
      expect(callArgs.subject).toContain('🎉 Your track "Neon Waves" is now LIVE on PromptFM!');
      expect(callArgs.html).toContain('Welcome to PromptFM Airplay!');
      expect(callArgs.html).toContain('View Weekly Chart');
    });

    it('sends rejected submission notification email with rejection reason', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockResolvedValueOnce({
        data: { id: 'status_email_888' },
        error: null,
      });

      const result = await sendSubmissionStatusEmail({
        recipientEmail: 'artist2@example.com',
        trackTitle: 'Noisy Beat',
        artistName: 'BeatMaker',
        status: 'rejected',
        rejectionReason: 'Audio clipping and low bitrate',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('status_email_888');

      const callArgs = mockSend.mock.calls[0]![0];
      expect(callArgs.subject).toBe('Update on your PromptFM track submission: "Noisy Beat"');
      expect(callArgs.html).toContain('Submission Update');
      expect(callArgs.html).toContain('Audio clipping and low bitrate');
      expect(callArgs.html).not.toContain('View Weekly Chart');
    });

    it('handles Resend API error in sendSubmissionStatusEmail', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid recipient email' },
      });

      const result = await sendSubmissionStatusEmail({
        recipientEmail: 'invalid-email',
        trackTitle: 'Test Song',
        artistName: 'Artist',
        status: 'approved',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recipient email');
    });

    it('handles exceptions in sendSubmissionStatusEmail', async () => {
      process.env.RESEND_API_KEY = 're_test_12345';
      mockSend.mockRejectedValueOnce(new Error('DNS lookup failure'));

      const result = await sendSubmissionStatusEmail({
        recipientEmail: 'artist@example.com',
        trackTitle: 'Test Song',
        artistName: 'Artist',
        status: 'rejected',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DNS lookup failure');
    });
  });
});
