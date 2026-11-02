// src/app/api/contact/route.ts
// Handles listener contact messages, DMCA inquiries, and feedback via Resend.

import { NextResponse } from 'next/server';
import { sendContactEmail } from '@/lib/email/resend';
import { evaluateHeuristicGuardrails } from '@/lib/safety/guardrails';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    // Guardrail safety check against severe abuse or injection
    const combinedText = `${name} ${subject} ${message}`;
    const safety = evaluateHeuristicGuardrails(combinedText);
    if (!safety.safe) {
      return NextResponse.json(
        { error: 'Message declined: Content violates broadcast standards.' },
        { status: 400 }
      );
    }

    const emailResult = await sendContactEmail({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to dispatch email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.id,
      fallback: emailResult.fallback,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
