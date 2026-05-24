import { describe, it, expect } from 'vitest';
import { signSession, verifySession } from '../src/auth/session.js';

const SECRET = 'test-secret-32-chars-minimum-aaa';

describe('session signing', () => {
  it('round-trips a payload', async () => {
    const cookie = await signSession({ login: 'alice', exp: Date.now() + 7 * 86400_000 }, SECRET);
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const payload = await verifySession(cookie, SECRET);
    expect(payload?.login).toBe('alice');
  });

  it('returns null for tampered signature', async () => {
    const cookie = await signSession({ login: 'alice', exp: Date.now() + 1000 }, SECRET);
    const tampered = cookie.slice(0, -2) + 'XX';
    expect(await verifySession(tampered, SECRET)).toBeNull();
  });

  it('returns null for tampered payload', async () => {
    const cookie = await signSession({ login: 'alice', exp: Date.now() + 1000 }, SECRET);
    const [pl, sig] = cookie.split('.');
    const tamperedPl = pl!.slice(0, -2) + 'XX';
    expect(await verifySession(`${tamperedPl}.${sig}`, SECRET)).toBeNull();
  });

  it('returns null for expired session', async () => {
    const cookie = await signSession({ login: 'alice', exp: Date.now() - 1000 }, SECRET);
    expect(await verifySession(cookie, SECRET)).toBeNull();
  });

  it('returns null for completely invalid format', async () => {
    expect(await verifySession('not-a-cookie', SECRET)).toBeNull();
    expect(await verifySession('', SECRET)).toBeNull();
    expect(await verifySession('a.b.c', SECRET)).toBeNull();
  });
});
