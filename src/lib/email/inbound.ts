// src/lib/email/inbound.ts
// Inbound Email Routing and Queue Protection Service (Issue #115)
// Routes incoming emails directly to admin-only handling (inbound_emails and content_reports)
// and protects listener request queues (/q) from email mailbox leakage.

import { createAdminClient } from '../supabase/server';
import { forwardInboundEmail, type ReceivedEmailDetail } from './receiving';
import { resolveForwarding } from './forwarding';
import { randomUUID } from 'crypto';

export interface InboundEmailPayload {
  from: string;
  to: string[];
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  emailId?: string | null;
}

export interface InboundEmailResult {
  success: boolean;
  category: 'complaint' | 'contact' | 'inquiry' | 'other';
  forwarded: boolean;
  reportId?: string;
  message?: string;
}

/**
 * Checks whether a community request entry represents an accidentally ingested inbound email.
 */
export function isEmailRequest(req: { content?: string | null; platform_user_id?: string | null } | null | undefined): boolean {
  if (!req?.content || typeof req.content !== 'string') return false;

  const content = req.content.trim();
  if (/^\[inbound(\s+resend|\s+email)?\]/i.test(content)) {
    return true;
  }

  if (typeof req.platform_user_id === 'string' && req.platform_user_id.includes('@')) {
    if (content.includes('To:') || content.includes('Subject:')) {
      return true;
    }
  }

  return false;
}

/**
 * Processes and routes an inbound email payload from Resend webhooks.
 * Directs complaints and legal notices to content_reports, forwards all incoming
 * mail to the station admin, and stores records in inbound_emails (never community_requests).
 */
export async function handleInboundEmail(payload: InboundEmailPayload): Promise<InboundEmailResult> {
  const { from, to, emailId } = payload;
  const recipients = Array.isArray(to) ? to : [to || 'dev@promptfm.live'];
  const recipientsStr = recipients.join(',').toLowerCase();
  const cleanSubject = typeof payload.subject === 'string' && payload.subject.trim() ? payload.subject.trim() : 'No Subject';
  const cleanBody = typeof payload.text === 'string' && payload.text ? payload.text : typeof payload.html === 'string' && payload.html ? payload.html : '';

  const routing = resolveForwarding(
    recipients,
    undefined,
    process.env.ADMIN_CONTACT_EMAIL ? [process.env.ADMIN_CONTACT_EMAIL] : []
  );
  const isComplaint =
    routing.category === 'complaint' ||
    recipientsStr.includes('complaint') ||
    recipientsStr.includes('dmca') ||
    /dmca|copyright|infringe|abuse|violation|harass/i.test(cleanSubject);


  const emailDetail: ReceivedEmailDetail = {
    id: emailId || randomUUID(),
    from,
    to: recipients,
    subject: cleanSubject,
    text: typeof payload.text === 'string' ? payload.text : null,
    html: typeof payload.html === 'string' ? payload.html : null,
    createdAt: new Date().toISOString(),
  };

  // 1. Forward email to station administrator
  let forwarded = false;
  try {
    const results = await Promise.all(routing.forwardTo.map((target) => forwardInboundEmail(emailDetail, target)));
    forwarded = results.some(Boolean);
  } catch {
    // remains false
  }

  // 2. Route to appropriate database tables (Admin-only)
  let reportId: string | undefined;

  try {
    const supabase = createAdminClient();

    // Route complaints, DMCA, and legal notices to moderation queue
    if (isComplaint) {
      const match =
        cleanBody.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) ||
        cleanSubject.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

      const targetId = match ? match[0] : `inbound-email-${cleanSubject.slice(0, 40)}`;
      const reason = /dmca|copyright|infringe/i.test(cleanSubject + cleanBody) ? 'copyright_dmca' : 'other';
      reportId = `email-${randomUUID().slice(0, 8)}`;

      await supabase.from('content_reports').insert({
        id: reportId,
        target_type: match ? 'track' : 'broadcast',
        target_id: targetId,
        reason,
        details: `[Inbound Email from ${from}]\nSubject: ${cleanSubject}\n\n${cleanBody.slice(0, 2000)}`,
        reporter_platform: 'web',
        reporter_id: from,
        status: 'pending',
      });
    }

    // Record in private inbound_emails table (NEVER community_requests)
    await supabase.from('inbound_emails').insert({
      resend_id: emailId || null,
      from_address: from,
      to_addresses: recipients,
      subject: cleanSubject,
      text_body: typeof payload.text === 'string' ? payload.text : null,
      html_body: typeof payload.html === 'string' ? payload.html : null,
      category: isComplaint ? 'complaint' : 'contact',
      status: forwarded ? 'forwarded' : 'received',
    });
  } catch {
    // Graceful fallback if database connection is unavailable
  }

  return {
    success: true,
    category: isComplaint ? 'complaint' : 'contact',
    forwarded,
    reportId,
    message: isComplaint
      ? 'Inbound complaint registered into moderation queue'
      : 'Inbound listener inquiry registered for admin handling',
  };
}
