export interface SessionPayload {
  login: string;
  exp: number;  // ms epoch
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - s.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  );
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(encoder.encode(json));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function verifySession(cookie: string, secret: string): Promise<SessionPayload | null> {
  if (!cookie || !cookie.includes('.')) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;
  const key = await importKey(secret);
  let sigBytes: Uint8Array;
  try { sigBytes = base64UrlDecode(sigB64); } catch { return null; }
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadB64));
  if (!valid) return null;
  let payload: SessionPayload;
  try { payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64))); }
  catch { return null; }
  if (payload.exp < Date.now()) return null;
  return payload;
}
