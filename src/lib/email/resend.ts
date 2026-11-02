// src/lib/email/resend.ts
// PromptFM Resend Email Service for listener inquiries, moderation alerts, and DMCA notifications.

import { Resend } from 'resend';
import type { ContentReport } from '@/types/database';

let resendInstance: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface ContactEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface EmailSendResult {
  success: boolean;
  id?: string;
  fallback?: boolean;
  error?: string;
}

const DEFAULT_SENDER = process.env.EMAIL_FROM || 'PromptFM Radio <contact@promptfm.live>';
const DEFAULT_STATION_INBOX = process.env.ADMIN_EMAIL || 'station@promptfm.live';

/**
 * Sends a listener contact or complaint inquiry to station staff.
 */
export async function sendContactEmail(payload: ContactEmailPayload): Promise<EmailSendResult> {
  const resend = getResendClient();

  if (!resend) {
    const fallbackId = `dev-${Date.now()}`;
    console.log(`[Email:DevFallback] From: ${payload.name} <${payload.email}> | Subject: "${payload.subject}" | Message: "${payload.message}"`);
    return { success: true, id: fallbackId, fallback: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_SENDER,
      to: [DEFAULT_STATION_INBOX],
      replyTo: payload.email,
      subject: `[PromptFM Contact] ${payload.subject}`,
      html: `
        <div style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px; border-radius: 8px;">
          <h2 style="color: #34d399; margin-top: 0;">📻 PromptFM Listener Message</h2>
          <p><strong>From:</strong> ${payload.name} (<a href="mailto:${payload.email}" style="color: #34d399;">${payload.email}</a>)</p>
          <p><strong>Subject:</strong> ${payload.subject}</p>
          <hr style="border: 1px solid #27272a; margin: 16px 0;" />
          <div style="white-space: pre-wrap; line-height: 1.6; background-color: #18181b; padding: 16px; border-radius: 6px;">
            ${payload.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </div>
          <p style="font-size: 12px; color: #71717a; margin-top: 20px;">
            PromptFM 24/7 AI Radio Station · Sent via Resend on promptfm.live
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Resend Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Resend Exception]', msg);
    return { success: false, error: msg };
  }
}

/**
 * Sends high-priority moderation / DMCA alert to station program directors.
 */
export async function sendContentReportAlert(report: ContentReport): Promise<EmailSendResult> {
  const resend = getResendClient();

  if (!resend) {
    const fallbackId = `dev-rep-${report.id}`;
    console.log(`[Email:DevFallback] Moderation Alert: Ticket ${report.id} on ${report.target_type} (${report.reason})`);
    return { success: true, id: fallbackId, fallback: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_SENDER,
      to: [DEFAULT_STATION_INBOX],
      subject: `⚠️ [MODERATION ALERT] ${report.reason.toUpperCase()} on ${report.target_type} (${report.id})`,
      html: `
        <div style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px; border-radius: 8px;">
          <h2 style="color: #ef4444; margin-top: 0;">🛡️ Content Moderation Ticket Filed</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="color: #a1a1aa; padding: 6px 0;">Report Ticket:</td><td style="font-family: monospace;">${report.id}</td></tr>
            <tr><td style="color: #a1a1aa; padding: 6px 0;">Target Type:</td><td><strong>${report.target_type.toUpperCase()}</strong></td></tr>
            <tr><td style="color: #a1a1aa; padding: 6px 0;">Target ID:</td><td style="font-family: monospace;">${report.target_id}</td></tr>
            <tr><td style="color: #a1a1aa; padding: 6px 0;">Violation Category:</td><td><span style="color: #f87171; font-weight: bold;">${report.reason}</span></td></tr>
            <tr><td style="color: #a1a1aa; padding: 6px 0;">Reporter Platform:</td><td>${report.reporter_platform}</td></tr>
          </table>
          <div style="background-color: #18181b; padding: 14px; border-radius: 6px; border-left: 4px solid #ef4444;">
            <strong>Details / Statement:</strong><br />
            ${(report.details || 'No additional details provided.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </div>
          <p style="margin-top: 20px;">
            <a href="https://promptfm.live/admin" style="background-color: #ef4444; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Review in Studio Console
            </a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Resend Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Notifies artist/creator of track moderation status (Approved / Rejected).
 */
export async function sendSubmissionStatusEmail({
  recipientEmail,
  trackTitle,
  artistName,
  status,
  rejectionReason,
}: {
  recipientEmail: string;
  trackTitle: string;
  artistName: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string;
}): Promise<EmailSendResult> {
  const resend = getResendClient();

  if (!resend) {
    return { success: true, id: `dev-sub-${Date.now()}`, fallback: true };
  }

  const isApproved = status === 'approved';
  const subject = isApproved
    ? `🎉 Your track "${trackTitle}" is now LIVE on PromptFM!`
    : `Update on your PromptFM track submission: "${trackTitle}"`;

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_SENDER,
      to: [recipientEmail],
      subject,
      html: `
        <div style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px; border-radius: 8px;">
          <h2 style="color: ${isApproved ? '#34d399' : '#f87171'}; margin-top: 0;">
            ${isApproved ? '🎉 Welcome to PromptFM Airplay!' : 'Submission Update'}
          </h2>
          <p>Hi ${artistName},</p>
          <p>
            ${
              isApproved
                ? `Your track <strong>"${trackTitle}"</strong> has passed station moderation and has entered the 24/7 continuous airplay rotation!`
                : `Thank you for submitting <strong>"${trackTitle}"</strong> to PromptFM. At this time, it could not be scheduled for airplay.`
            }
          </p>
          ${
            rejectionReason
              ? `<div style="background-color: #18181b; padding: 12px; border-radius: 6px; border-left: 3px solid #f87171; margin: 16px 0;"><strong>Reason:</strong> ${rejectionReason}</div>`
              : ''
          }
          ${
            isApproved
              ? `<p><a href="https://promptfm.live/top" style="background-color: #10b981; color: black; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Weekly Chart</a></p>`
              : ''
          }
          <p style="font-size: 12px; color: #71717a; margin-top: 24px;">
            PromptFM 24/7 AI Music Radio · <a href="https://promptfm.live" style="color: #34d399;">promptfm.live</a>
          </p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

