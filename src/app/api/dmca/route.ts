// src/app/api/dmca/route.ts
// Statutory DMCA Notice Intake API Endpoint (17 U.S.C. § 512(c)(3))
// Validates formal copyright takedown requests, files tickets, and alerts compliance officers.

import { NextResponse } from 'next/server';
import { validateDmcaNoticePayload, type DmcaNoticePayload } from '@/lib/legal/policies';
import { submitContentReport } from '@/lib/safety/reports';

export async function POST(req: Request) {
  let body: DmcaNoticePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateDmcaNoticePayload(body);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Statutory DMCA notice requirements incomplete',
        errors: validation.errors,
      },
      { status: 400 }
    );
  }

  const detailsFormatted = [
    `Copyright Owner: ${body.copyrightOwner}`,
    `Claimant: ${body.claimantName} (${body.claimantEmail})`,
    `Work Claimed: ${body.workDescription}`,
    `Infringing Material: ${body.infringingIdentifier}`,
    body.details ? `Additional Details: ${body.details}` : null,
    `Signed by: ${body.signature}`,
  ]
    .filter(Boolean)
    .join('\n');

  const reportResult = await submitContentReport({
    target_type: 'track',
    target_id: body.infringingIdentifier.trim(),
    reason: 'copyright_dmca',
    details: detailsFormatted,
    reporter_platform: 'web',
    reporter_id: body.claimantEmail.trim(),
  });

  return NextResponse.json(
    {
      success: true,
      ticketId: reportResult.reportId,
      message:
        'Formal DMCA takedown notice received and forwarded to the PromptFM Designated Copyright Agent. Takedowns are processed within 24 hours pursuant to 17 U.S.C. § 512.',
    },
    { status: 201 }
  );
}

