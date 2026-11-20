import { authenticate, enroll, allowedConfig, bearer } from './deviceAccess.mjs';
import { deviceStore, verifyTarget, allowEnrollment, openDeviceStore } from './store';

export function betaConfig() {
  return {
    enabled: process.env.THREADLY_NATIVE_BETA === 'isolated-synthetic-only',
    syntheticOnly: process.env.THREADLY_BETA_SYNTHETIC_ONLY === 'true',
    targetId: process.env.THREADLY_BETA_TARGET_ID || '',
    expiresAt: Number(process.env.THREADLY_BETA_EXPIRES_AT_MS),
  };
}
export function betaEnabled() { return process.env.THREADLY_NATIVE_BETA !== undefined; }

/** Store-native open play: devices self-enroll for an isolated credential; web guests are unaffected. */
export function openNativeEnabled() { return process.env.THREADLY_NATIVE_OPEN === 'device-credentials'; }

export type NativePrincipal = { guestId: string; expiresAt?: number; open?: boolean };

/**
 * Authenticate a presented device credential. Tries the isolated synthetic beta
 * target first (legacy lane), then open store-native devices. Returns null when
 * no credential is presented OR none matches; callers use credentialPresent() to
 * tell "no credential" (web guest path) apart from "bad credential" (401).
 */
export async function nativePrincipal(request: Request): Promise<NativePrincipal | null> {
  const header = request.headers.get('authorization');
  if (!bearer(header)) return null;
  const config = betaConfig();
  if (allowedConfig(config, Date.now()) && await verifyTarget(config.targetId, config.expiresAt)) {
    const beta = await authenticate(header, { config, store: deviceStore });
    if (beta) return beta;
  }
  if (openNativeEnabled()) {
    const open = await openDeviceStore.findOpenDevice(header!);
    if (open) return { guestId: open.guestId, expiresAt: open.expiresAt, open: true };
  }
  return null;
}

export function credentialPresent(request: Request): boolean {
  return bearer(request.headers.get('authorization')) !== null;
}

/**
 * Open store-native enrollment: no invitation. Issues one isolated device
 * credential (90 days, rolling). Rate-limited globally like the beta lane.
 */
export async function openEnroll() {
  if (!openNativeEnabled()) return null;
  if (!await openDeviceStore.allowOpenEnrollment()) return null;
  return openDeviceStore.createOpenDevice();
}

/** Legacy isolated-beta enrollment (invitation required). Unchanged. */
export async function nativeEnroll(code: unknown) {
  const config = betaConfig();
  if (!allowedConfig(config, Date.now())) return null;
  if (!await verifyTarget(config.targetId, config.expiresAt)) return null;
  return await allowEnrollment(config.targetId) ? enroll(code, { config, store: deviceStore }) : null;
}
