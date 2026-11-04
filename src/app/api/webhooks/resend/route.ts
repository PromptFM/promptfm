// src/app/api/webhooks/resend/route.ts
// Official Resend Inbound Webhook & Email Forwarding Endpoint
// Automatically forwards incoming messages to dev@promptfm.live directly to admin inbox.

import { NextResponse } from 'next/server';
import { getReceivedEmail, forwardInboundEmail } from '@/lib/email/receiving';
import { createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Handle official Resend 'email.received' webhook event
    if (payload.type === 'email.received' && payload.data?.email_id) {
      const emailId = payload.data.email_id as string;
      const emailDetail = await getReceivedEmail(emailId);

      if (emailDetail) {
        const adminEmail = process.env.ADMIN_CONTACT_EMAIL || 'trifan.alex.criss@gmail.com';
        await forwardInboundEmail(emailDetail, adminEmail);

        try {
          const supabase = createAdminClient();
          await supabase.from('community_requests').insert({
            platform: 'web',
            platform_user_id: emailDetail.from,
            platform_user_name: emailDetail.from.split('@')[0] || 'Email Sender',
            type: 'song',
            content: `[Inbound Resend] To: ${emailDetail.to.join(', ')} | ${emailDetail.subject}: ${(emailDetail.text || emailDetail.html || '').slice(0, 500)}`,
            status: 'pending',
          });
        } catch {
          // Graceful fallback if database connection is idle
        }
      }

      return NextResponse.json({ success: true, event: 'email.received', emailId });
    }

    // Direct legacy payload support
    const { from, to, subject, text, html } = payload;
    if (from && typeof from === 'string') {
      const adminEmail = process.env.ADMIN_CONTACT_EMAIL || 'trifan.alex.criss@gmail.com';
      await forwardInboundEmail(
        {
          id: randomUUID(),
          from,
          to: Array.isArray(to) ? to : [to || 'dev@promptfm.live'],
          subject: typeof subject === 'string' ? subject : 'No Subject',
          text: typeof text === 'string' ? text : null,
          html: typeof html === 'string' ? html : null,
          createdAt: new Date().toISOString(),
        },
        adminEmail
      );

      return NextResponse.json({ success: true, mode: 'direct' });
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
