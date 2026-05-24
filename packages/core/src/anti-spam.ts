/**
 * Honeypot:hidden input,机器人通常会填,人不会
 */
export function checkHoneypot(value: string | undefined): boolean {
  return !value;
}

/**
 * 时间陷阱:表单加载到提交至少要 minTimeMs
 */
export function checkTimeOnForm(elapsedMs: number, minTimeMs: number): boolean {
  if (minTimeMs <= 0) return true;
  return elapsedMs >= minTimeMs;
}

/**
 * 每分钟同 IP+formId 提交次数 ≤ limit
 *
 * Key 格式:`ratelimit:{ip}:{formId}:{minuteEpoch}`
 * TTL 90s,自然清理
 */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  formId: string,
  limit: number,
): Promise<boolean> {
  const minuteEpoch = Math.floor(Date.now() / 60_000);
  const key = `ratelimit:${ip}:${formId}:${minuteEpoch}`;
  const currentRaw = await kv.get(key);
  const current = currentRaw ? parseInt(currentRaw, 10) : 0;
  if (current >= limit) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 90 });
  return true;
}
