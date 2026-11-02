// src/lib/supabase/client.ts
// Browser-side Supabase client (singleton).
// Import this in Client Components and browser-only utilities.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

