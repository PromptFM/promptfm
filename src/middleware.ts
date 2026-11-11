// src/middleware.ts
// Shared authentication guard middleware for /api/admin/*

import { NextRequest, NextResponse } from 'next/server';
import { shouldAllowAdminRequestThroughMiddleware } from '@/lib/auth/admin-auth';

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    if (!shouldAllowAdminRequestThroughMiddleware(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
