import { authenticate, enroll, allowedConfig } from './deviceAccess.mjs';
import { deviceStore, verifyTarget, allowEnrollment } from './store';

export function betaConfig() {
  return {
    enabled: process.env.THREADLY_NATIVE_BETA === 'isolated-synthetic-only',
    syntheticOnly: process.env.THREADLY_BETA_SYNTHETIC_ONLY === 'true',
    targetId: process.env.THREADLY_BETA_TARGET_ID || '',
    expiresAt: Number(process.env.THREADLY_BETA_EXPIRES_AT_MS),
  };
}
export function betaEnabled() { return process.env.THREADLY_NATIVE_BETA !== undefined; }
async function verifiedConfig() {
  const config = betaConfig();
  if (!allowedConfig(config, Date.now()) || !await verifyTarget(config.targetId, config.expiresAt)) return null;
  return config;
}
export async function nativePrincipal(request: Request): Promise<{ guestId: string } | null> {
  const config = await verifiedConfig();
  return config ? authenticate(request.headers.get('authorization'), { config, store: deviceStore }) : null;
}
export async function nativeEnroll(code: unknown) {
  const config = await verifiedConfig();
  return config && await allowEnrollment(config.targetId) ? enroll(code, { config, store: deviceStore }) : null;
}
