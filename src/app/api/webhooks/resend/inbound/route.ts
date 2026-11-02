// src/app/api/webhooks/resend/inbound/route.ts
// Inbound email processing webhook for Resend.
// Receives incoming messages sent to @promptfm.live (contact, complaints, DMCA notices).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { from, to, subject, text, html } = payload;

    if (!from || typeof from !== 'string') {
      return NextResponse.json({ error: 'Sender "from" address is required' }, { status: 400 });
    }

    const recipients = Array.isArray(to) ? to.join(',').toLowerCase() : String(to || '').toLowerCase();
    const cleanSubject = typeof subject === 'string' ? subject : 'No Subject';
    const cleanBody = typeof text === 'string' ? text : typeof html === 'string' ? html : '';

    const isComplaint =
      recipients.includes('complaint') ||
      recipients.includes('dmca') ||
      recipients.includes('legal') ||
      /dmca|copyright|infringe|abuse|violation|harass/i.test(cleanSubject);

    const supabase = createAdminClient();

    if (isComplaint) {
      // Extract track target if mentioned or fallback to email subject
      const match = cleanBody.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) ||
                    cleanSubject.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const targetId = match ? match[0] : `inbound-email-${cleanSubject.slice(0, 40)}`;

      const reason = /dmca|copyright|infringe/i.test(cleanSubject + cleanBody)
        ? 'copyright_dmca'
        : 'other';

      await supabase.from('content_reports').insert({
        id: `email-${randomUUID().slice(0, 8)}`,
        target_type: match ? 'track' : 'broadcast',
        target_id: targetId,
        reason,
        details: `[Inbound Email from ${from}]\nSubject: ${cleanSubject}\n\n${cleanBody.slice(0, 2000)}`,
        reporter_platform: 'web',
        reporter_id: from,
        status: 'pending',
      });

      return NextResponse.json({
        success: true,
        category: 'complaint',
        message: 'Inbound complaint registered into moderation queue',
      });
    }

    // General listener contact / inquiry
    await supabase.from('community_requests').insert({
      platform: 'web',
      platform_user_id: from,
      platform_user_name: from.split('@')[0] || 'Email Listener',
      type: 'song',
      content: `[Inbound Email] ${cleanSubject}: ${cleanBody.slice(0, 500)}`,
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      category: 'contact',
      message: 'Inbound listener inquiry registered',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process webhook';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

