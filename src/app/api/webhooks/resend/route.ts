// src/app/api/webhooks/resend/route.ts
// Official Resend Inbound Webhook & Email Forwarding Endpoint
// Automatically forwards incoming messages to dev@promptfm.live directly to admin inbox.

import { NextResponse } from 'next/server';
import { getReceivedEmail } from '@/lib/email/receiving';
import { handleInboundEmail } from '@/lib/email/inbound';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Handle official Resend 'email.received' webhook event
    if (payload.type === 'email.received' && payload.data?.email_id) {
      const emailId = payload.data.email_id as string;
      const emailDetail = await getReceivedEmail(emailId);

      if (emailDetail) {
        await handleInboundEmail({
          from: emailDetail.from,
          to: emailDetail.to,
          subject: emailDetail.subject,
          text: emailDetail.text,
          html: emailDetail.html,
          emailId,
        });
      }

      return NextResponse.json({ success: true, event: 'email.received', emailId });
    }

    // Direct legacy payload support
    const { from, to, subject, text, html } = payload;
    if (from && typeof from === 'string') {
      const recipients = Array.isArray(to) ? to : [to || 'dev@promptfm.live'];
      await handleInboundEmail({
        from,
        to: recipients,
        subject: typeof subject === 'string' ? subject : 'No Subject',
        text: typeof text === 'string' ? text : null,
        html: typeof html === 'string' ? html : null,
      });

      return NextResponse.json({ success: true, mode: 'direct' });
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
