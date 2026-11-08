// src/app/api/status/route.ts
// Live system health probe endpoint with Shields.io dynamic badge support

import { NextRequest, NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/status/health-checker';
import { generateBadgeSvg } from '@/lib/badges/badge-generator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let format: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    format = searchParams.get('format');

    const health = await checkSystemHealth();

    // Direct standalone SVG badge (bypasses Shields.io rate limits and Camo proxy timeouts)
    if (format === 'svg') {
      let message = 'Operational';
      let color = '#2ea44f';

      if (health.status === 'degraded_performance') {
        message = 'Degraded';
        color = '#dfb317';
      } else if (health.status === 'major_outage') {
        message = 'Outage';
        color = '#e05d44';
      }

      const svg = generateBadgeSvg({
        label: 'PromptFM Status',
        message,
        color,
      });

      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

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
    if (format === 'svg') {
      const svg = generateBadgeSvg({
        label: 'PromptFM Status',
        message: 'Outage',
        color: '#e05d44',
      });
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

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

