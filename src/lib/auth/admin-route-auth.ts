// src/lib/auth/admin-route-auth.ts
// Route-handler-only admin authorization that can verify Supabase sessions.

import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  canBypassUnconfiguredAdminAuth,
  hasLikelySupabaseSessionCookie,
  hasValidAdminApiKey,
  isAdminEmailAuthorized,
} from '@/lib/auth/admin-auth';

export async function isAdminAuthorized(req: NextRequest | Request): Promise<boolean> {
  if (hasValidAdminApiKey(req)) {
    return true;
  }

  if (hasLikelySupabaseSessionCookie(req)) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user && isAdminEmailAuthorized(user.email)) {
        return true;
      }
    } catch {
      // Fail closed below.
    }
  }

  return canBypassUnconfiguredAdminAuth();
}
