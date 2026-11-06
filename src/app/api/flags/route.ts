// src/app/api/flags/route.ts
// Public Feature Flags status endpoint for client hydration and UI widgets

import { NextRequest, NextResponse } from 'next/server';
import { getAllFeatureFlags } from '@/lib/flags/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET(_req?: NextRequest) {
  const flags = getAllFeatureFlags();
  const dictionary: Record<string, boolean> = {};

  for (const flag of flags) {
    dictionary[flag.key] = flag.enabled;
  }

  return NextResponse.json({
    success: true,
    flags: dictionary,
  });
}
