// src/lib/auth/admin-auth.ts
// Shared admin auth utilities safe to use in route handlers, middleware, and client-adjacent code.

import type { NextRequest } from 'next/server';

type RequestLike = NextRequest | Request;

const SUPABASE_SESSION_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getConfiguredAdminEmails(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmailAuthorized(email?: string | null): boolean {
  const allowedEmails = getConfiguredAdminEmails();
  if (allowedEmails.length === 0) {
    return !isProductionEnvironment();
  }

  const normalizedEmail = email?.trim().toLowerCase();
  return Boolean(normalizedEmail && allowedEmails.includes(normalizedEmail));
}

export function hasConfiguredAdminApiKey(): boolean {
  return Boolean(process.env.ADMIN_API_KEY?.trim());
}

export function canBypassUnconfiguredAdminAuth(): boolean {
  return !hasConfiguredAdminApiKey() && !isProductionEnvironment();
}

export function hasValidAdminApiKey(req: RequestLike): boolean {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (!adminKey) {
    return false;
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

export function hasLikelySupabaseSessionCookie(req: RequestLike): boolean {
  const cookieHeader = req.headers.get('cookie');
  return Boolean(cookieHeader && SUPABASE_SESSION_COOKIE_PATTERN.test(cookieHeader));
}

export function shouldAllowAdminRequestThroughMiddleware(req: RequestLike): boolean {
  return (
    hasValidAdminApiKey(req) ||
    hasLikelySupabaseSessionCookie(req) ||
    canBypassUnconfiguredAdminAuth()
  );
}
