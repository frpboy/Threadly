/** No defaults or existing auth-key reuse. Missing/invalid settings disable this additive lane. */
export function attemptConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const origin = env.ATTEMPT_V2_ORIGIN;
  const key = env.ATTEMPT_V2_REVISION_KEY_HEX;
  const epoch = env.ATTEMPT_V2_REVISION_EPOCH;
  if (!origin || !key || !epoch || !/^[a-f0-9]{64}$/i.test(key) || !/^[A-Za-z0-9_-]{1,32}$/.test(epoch)) return null;
  try { const parsed = new URL(origin); if (parsed.protocol !== "https:" || parsed.origin !== origin) return null; }
  catch { return null; }
  const limits = [env.ATTEMPT_V2_MAX_TOTAL, env.ATTEMPT_V2_MAX_OWNER, env.ATTEMPT_V2_MAX_PUZZLE];
  if (limits.some(v => !v || !/^[1-9][0-9]{0,5}$/.test(v))) return null;
  const [total, owner, puzzle] = limits.map(Number);
  if (puzzle > owner || owner > total) return null;
  return { origin, key: Buffer.from(key, "hex"), epoch, limits: {total, owner, puzzle} };
}
