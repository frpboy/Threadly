import { boundedJson, BodyLimit } from "@/services/nativeBeta/body";
import { NextResponse } from 'next/server';
import { betaEnabled, nativeEnroll, openNativeEnabled, openEnroll } from '@/services/nativeBeta/access';
import { captureHandledApiError } from "@/services/apiErrorCapture";
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!betaEnabled() && !openNativeEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  try {
    const body = await boundedJson(request, 256);
    const code = body && typeof body === 'object' && 'code' in body ? body.code : null;
    // Open store-native play: an absent/empty code self-enrolls one isolated device
    // credential (rate-limited). A non-empty code only ever redeems a legacy
    // owner-issued invitation for the isolated synthetic beta lane.
    if ((code === null || code === '') && openNativeEnabled()) {
      const issued = await openEnroll();
      return issued
        ? NextResponse.json({ token: issued.token, guestId: issued.guestId, expiresAt: issued.expiresAt }, { headers })
        : NextResponse.json({ error: 'Enrollment unavailable' }, { status: 503, headers });
    }
    const result = await nativeEnroll(code);
    return result ? NextResponse.json(result, { headers }) : NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 401, headers });
  } catch (error) {
    if (error instanceof BodyLimit || error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid invitation request' }, { status: 400, headers });
    captureHandledApiError("beta/enroll", error);
    return NextResponse.json({ error: 'Enrollment unavailable' }, { status: 503, headers });
  }
}
