import { NextResponse } from 'next/server';
import { nativePrincipal, authorizationPresent, openNativeEnabled } from '@/services/nativeBeta/access';
import { deleteIdentityData, openDeviceStore } from '@/services/nativeBeta/store';
import { claimableGuestId } from '@/services/requestValidation';
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
    if (authorizationPresent(request)) {
      let guestId: string | null = null;
      const device = await nativePrincipal(request);
      if (device) {
        // The legacy synthetic beta lane has no self-serve deletion (test data only).
        if (!device.open || !openNativeEnabled()) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
        }
        guestId = device.guestId;
      } else if (openNativeEnabled()) {
        // A credential past its request cap or expiry still proves possession for
        // deletion (never for gameplay). A malformed header or unknown/revoked
        // credential can never fall through to the guest path.
        guestId = await openDeviceStore.findOpenDeviceForDeletion(request.headers.get('authorization')!);
      }
      if (!guestId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
      }
      // One transaction: data rows AND the credential revocation commit or roll back together.
      const { counts, deviceRemoved } = await deleteIdentityData(guestId, request.headers.get('authorization'));
      return NextResponse.json({ deleted: true, identity: 'device', counts, deviceRemoved }, { headers });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400, headers });
    }
    const { guest_id: guestId, confirm } = (body ?? {}) as Record<string, unknown>;
    // Guests prove possession with their high-entropy browser id. Server-issued
    // identities (dev-*/beta-*) are NOT deletable this way: they require their
    // credential, otherwise anyone who learned a player ID could wipe it.
    if (confirm !== true || !claimableGuestId(guestId)) {
      return NextResponse.json({ error: 'guest_id and confirm:true are required' }, { status: 400, headers });
    }
    const { counts } = await deleteIdentityData(guestId as string);
    return NextResponse.json({ deleted: true, identity: 'guest', counts }, { headers });
  } catch (error) {
    captureHandledApiError('player-data/delete', error);
    return NextResponse.json({ error: 'Deletion unavailable' }, { status: 503, headers });
  }
}
