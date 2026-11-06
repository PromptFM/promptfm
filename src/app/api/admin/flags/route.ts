// src/app/api/admin/flags/route.ts
// Admin Feature Flags & Kill Switch Management Endpoint
// Authenticated via Authorization: Bearer <ADMIN_API_KEY>, x-admin-key, or ?key=

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthorized } from '@/lib/auth/admin-auth';
import {
  getAllFeatureFlags,
  getFeatureFlag,
  setFeatureFlag,
  toggleFeatureFlag,
  type FeatureFlagCategory,
} from '@/lib/flags/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url, 'http://localhost');
  const category = (searchParams.get('category') as FeatureFlagCategory) || undefined;
  const killSwitchOnly = searchParams.get('killSwitchOnly') === 'true';

  const flags = getAllFeatureFlags({ category, killSwitchOnly });
  return NextResponse.json({
    success: true,
    flags,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { key, enabled, notes, actor } = body || {};

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "key" field.' }, { status: 400 });
    }

    if (enabled === undefined || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing or invalid "enabled" boolean field.' }, { status: 400 });
    }

    const flagActor = actor?.trim() || req.headers.get('x-admin-actor') || 'admin';

    const updated = await setFeatureFlag({
      key: key.trim(),
      enabled,
      actor: flagActor,
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      flag: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { key, notes, actor } = body || {};

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "key" field.' }, { status: 400 });
    }

    const flagActor = actor?.trim() || req.headers.get('x-admin-actor') || 'admin';
    const updated = await toggleFeatureFlag(key.trim(), flagActor, notes);

    return NextResponse.json({
      success: true,
      flag: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

