import { NextResponse } from 'next/server';
import { nativePrincipal, credentialPresent, openNativeEnabled } from '@/services/nativeBeta/access';
import { openDeviceStore, deleteGuestData } from '@/services/nativeBeta/store';
import { validGuestId } from '@/services/requestValidation';
import { captureHandledApiError } from "@/services/apiErrorCapture";

const headers = { 'Cache-Control': 'private, no-store' };

/**
 * Player-data deletion (Play "Data deletion" requirement).
 * Native: the live device credential is the proof; it revokes itself and deletes its identity.
 * Web guest: the high-entropy guest_id (random, stored only in the player's own browser
 * localStorage, never logged in URLs) is the possession proof. No email/name exists to check.
 * Deleting gameplay history is irreversible but exposes nothing to anyone else.
 */
export async function DELETE(request: Request) {
  try {
    if (credentialPresent(request)) {
      const device = await nativePrincipal(request);
      if (!device || !device.open || !openNativeEnabled()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
      }
      const revokedGuest = await openDeviceStore.revokeOpenDevice(request.headers.get('authorization')!);
      const counts = await deleteGuestData(device.guestId);
      return NextResponse.json({ deleted: true, identity: 'device', counts, deviceRevoked: revokedGuest !== null }, { headers });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400, headers });
    }
    const { guest_id: guestId, confirm } = (body ?? {}) as Record<string, unknown>;
    if (confirm !== true || !validGuestId(guestId)) {
      return NextResponse.json({ error: 'guest_id and confirm:true are required' }, { status: 400, headers });
    }
    const counts = await deleteGuestData(guestId as string);
    return NextResponse.json({ deleted: true, identity: 'guest', counts }, { headers });
  } catch (error) {
    captureHandledApiError('player-data/delete', error);
    return NextResponse.json({ error: 'Deletion unavailable' }, { status: 503, headers });
  }
}
