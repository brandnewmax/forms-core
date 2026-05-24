import type { Env } from '../types.js';
import { signSession } from './session.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function handleLogin(_req: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.ADMIN_BASE_URL) {
    return new Response('OAuth not configured', { status: 500 });
  }
  const state = crypto.randomUUID();
  const redirectUri = `${env.ADMIN_BASE_URL}/admin/auth/callback`;
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);

  const stateCookie = `mf_oauth_state=${state}; Path=/admin/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Set-Cookie': stateCookie },
  });
}

export async function handleCallback(req: Request, env: Env): Promise<Response> {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state');
  if (!code || !state) return errorPage(400, 'Missing code or state');

  const cookies = parseCookies(req.headers.get('Cookie') ?? '');
  if (cookies.mf_oauth_state !== state) return errorPage(400, 'State mismatch');

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response('OAuth not configured', { status: 500 });
  }

  const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenJson = await tokenResp.json() as { access_token?: string };
  if (!tokenJson.access_token) return errorPage(401, 'Token exchange failed');

  const userResp = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${tokenJson.access_token}`, 'User-Agent': 'mmldigi-forms' },
  });
  const user = await userResp.json() as { login?: string };
  if (!user.login) return errorPage(401, 'Cannot read user');

  const allowed = (env.ADMIN_GITHUB_USERS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(user.login)) {
    return errorPage(403, `User '${user.login}' not in admin allowlist`);
  }

  const payload = { login: user.login, exp: Date.now() + SESSION_TTL_MS };
  const cookie = await signSession(payload, env.SESSION_SECRET);
  const sessionCookie = `mf_session=${cookie}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
  const clearStateCookie = `mf_oauth_state=; Path=/admin/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ['Location', '/admin/'],
      ['Set-Cookie', sessionCookie],
      ['Set-Cookie', clearStateCookie],
    ]),
  });
}

export async function handleLogout(_req: Request, _env: Env): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: new Headers([
      ['Location', '/admin/login.html'],
      ['Set-Cookie', `mf_session=; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`],
    ]),
  });
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of header.split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}

function errorPage(status: number, message: string): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:40px;color:#1A1A1A;">
       <h1>Admin login error</h1><p>${message}</p>
       <p><a href="/admin/login.html">Try again</a></p>
     </body></html>`,
    { status, headers: { 'Content-Type': 'text/html' } },
  );
}
