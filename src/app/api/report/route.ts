// src/app/api/report/route.ts
// Public content reporting API endpoint.
// Accepts reports from Web UI, Discord, Telegram, or MCP agents.

import { NextRequest, NextResponse } from 'next/server';
import { submitContentReport } from '@/lib/safety/reports';
import type { ReportReason, ReportTargetType, ReporterPlatform } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      target_type = 'track',
      target_id,
      reason,
      details,
      reporter_platform = 'web',
      reporter_id,
    } = body;

    if (!target_id || typeof target_id !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: target_id' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: reason' },
        { status: 400 }
      );
    }

    const validReasons: ReportReason[] = [
      'copyright_dmca',
      'hate_harassment',
      'religious_ethical',
      'unlabeled_18_plus',
      'spam_abuse',
      'other',
    ];

    if (!validReasons.includes(reason as ReportReason)) {
      return NextResponse.json(
        {
          error: `Invalid report reason. Must be one of: ${validReasons.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const result = await submitContentReport({
      target_type: (target_type as ReportTargetType) || 'track',
      target_id: String(target_id),
      reason: reason as ReportReason,
      details: typeof details === 'string' ? details : undefined,
      reporter_platform: (reporter_platform as ReporterPlatform) || 'web',
      reporter_id: reporter_id ? String(reporter_id) : undefined,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API Report Error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

