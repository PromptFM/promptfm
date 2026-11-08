// src/app/api/webhooks/resend/inbound/route.ts
// Inbound email processing webhook for Resend.
// Receives incoming messages sent to @promptfm.live (contact, complaints, DMCA notices).

import { NextResponse } from 'next/server';
import { handleInboundEmail } from '@/lib/email/inbound';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { from, to, subject, text, html } = payload;

    if (!from || typeof from !== 'string') {
      return NextResponse.json({ error: 'Sender "from" address is required' }, { status: 400 });
    }

    const recipients = Array.isArray(to) ? to : [to || 'contact@promptfm.live'];
    const result = await handleInboundEmail({
      from,
      to: recipients,
      subject,
      text,
      html,
    });

    return NextResponse.json({
      success: result.success,
      category: result.category,
      message: result.message,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process webhook';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
