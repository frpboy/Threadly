import { NextResponse, type NextRequest } from 'next/server';

/** The dedicated native beta exposes NO web/admin/account or legacy guest endpoints. */
export function proxy(request: NextRequest) {
  if (process.env.THREADLY_NATIVE_BETA === undefined) return NextResponse.next();
  const routes: Record<string, string> = {
    '/api/beta/enroll': 'POST', '/api/daily': 'GET', '/api/progress': 'POST', '/api/guess': 'POST',
  };
  if (routes[request.nextUrl.pathname] !== request.method) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }
  return NextResponse.next();
}
export const config = { matcher: '/:path*' };
