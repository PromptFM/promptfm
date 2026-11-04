// src/app/api/status/route.ts
// Live system health probe endpoint with Shields.io dynamic badge support

import { NextRequest, NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/status/health-checker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const health = await checkSystemHealth();

    // Shields.io dynamic endpoint badge format
    if (format === 'badge') {
      let message = 'Operational';
      let color = 'brightgreen';

      if (health.status === 'degraded_performance') {
        message = 'Degraded';
        color = 'yellow';
      } else if (health.status === 'major_outage') {
        message = 'Major Outage';
        color = 'red';
      }

      return NextResponse.json(
        {
          schemaVersion: 1,
          label: 'PromptFM Status',
          message,
          color,
          isError: health.status === 'major_outage',
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    const httpStatus = health.status === 'major_outage' ? 503 : 200;

    return NextResponse.json(health, {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown internal error';
    return NextResponse.json(
      {
        status: 'major_outage',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

