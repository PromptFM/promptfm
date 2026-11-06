// src/lib/auth/admin-auth.ts
// Shared authentication guard helper for admin endpoints and middleware

import { NextRequest } from 'next/server';

/**
 * Validates whether the incoming request is authorized as an administrator.
 *
 * Supports:
 * - Authorization: Bearer <ADMIN_API_KEY>
 * - x-admin-key: <ADMIN_API_KEY>
 * - ?key=<ADMIN_API_KEY>
 *
 * In local development, if ADMIN_API_KEY is unset or empty, requests are allowed by default.
 */
export function isAdminAuthorized(req: NextRequest | Request): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return true; // Default allow in local dev when unconfigured
  }

  const authHeader = req.headers.get('authorization');
  const xAdminKey = req.headers.get('x-admin-key');

  let queryKey: string | null = null;
  if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      queryKey = parsedUrl.searchParams.get('key');
    } catch {
      queryKey = null;
    }
  }

  return (
    authHeader === `Bearer ${adminKey}` ||
    xAdminKey === adminKey ||
    queryKey === adminKey
  );
}
