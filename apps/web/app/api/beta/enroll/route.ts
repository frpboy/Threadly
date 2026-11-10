import { boundedJson, BodyLimit } from "@/services/nativeBeta/body";
import { NextResponse } from 'next/server';
import { betaEnabled, nativeEnroll } from '@/services/nativeBeta/access';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!betaEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  try {
    // High-entropy owner-issued, one-time invitation. No email/admin secret in the APK.
    const body = await boundedJson(request, 256);
    const code = body && typeof body === 'object' && 'code' in body ? body.code : null;
    const result = await nativeEnroll(code);
    return result ? NextResponse.json(result, { headers }) : NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 401, headers });
  } catch (error) {
    if (error instanceof BodyLimit || error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid invitation request' }, { status: 400, headers });
    return NextResponse.json({ error: 'Enrollment unavailable' }, { status: 503, headers });
  }
}
