// src/app/.well-known/vercel/flags/route.ts
// Official Vercel Flags Discovery Endpoint for Vercel Flags Explorer and Vercel Toolbar

import { createFlagsDiscoveryEndpoint } from 'flags/next';
import { getVercelDiscoveryApiData } from '@/lib/flags/vercel';

export const dynamic = 'force-dynamic';

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return getVercelDiscoveryApiData();
});
