import { describe, it, expect } from 'vitest';
import { getAuthedUser, requireAuth } from '../src/auth/middleware.js';
import { signSession } from '../src/auth/session.js';

const SECRET = 'test-secret-32-chars-minimum-aaaaa';

describe('getAuthedUser', () => {
  it('returns login from valid session cookie', async () => {
    const cookie = await signSession({ login: 'alice', exp: Date.now() + 60_000 }, SECRET);
    const req = new Request('https://x', { headers: { Cookie: `mf_session=${cookie}` } });
    expect(await getAuthedUser(req, SECRET)).toBe('alice');
  });

  it('returns null when no cookie', async () => {
    const req = new Request('https://x');
    expect(await getAuthedUser(req, SECRET)).toBeNull();
  });

  it('returns null for bad signature', async () => {
    const req = new Request('https://x', { headers: { Cookie: 'mf_session=garbage.also-garbage' } });
    expect(await getAuthedUser(req, SECRET)).toBeNull();
  });
});

describe('requireAuth', () => {
  it('returns null and a 302 Response when not authed', async () => {
    const req = new Request('https://x/admin/api/submissions');
    const r = await requireAuth(req, SECRET);
    expect(r.user).toBeNull();
    expect(r.response?.status).toBe(302);
    expect(r.response?.headers.get('Location')).toBe('/admin/login.html');
  });

  it('returns user and no response when authed', async () => {
    const cookie = await signSession({ login: 'alice', exp: Date.now() + 60_000 }, SECRET);
    const req = new Request('https://x', { headers: { Cookie: `mf_session=${cookie}` } });
    const r = await requireAuth(req, SECRET);
    expect(r.user).toBe('alice');
    expect(r.response).toBeNull();
  });

  it('returns 401 JSON when jsonOn401 option is set', async () => {
    const req = new Request('https://x/admin/api/submissions');
    const r = await requireAuth(req, SECRET, { jsonOn401: true });
    expect(r.response?.status).toBe(401);
    expect(r.response?.headers.get('Content-Type')).toMatch(/json/);
  });
});
