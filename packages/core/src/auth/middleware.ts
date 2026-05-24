import { verifySession } from './session.js';

function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const c of header.split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}

export async function getAuthedUser(req: Request, sessionSecret: string): Promise<string | null> {
  const cookies = parseCookieHeader(req.headers.get('Cookie'));
  const session = cookies.mf_session;
  if (!session) return null;
  const payload = await verifySession(session, sessionSecret);
  return payload?.login ?? null;
}

export interface RequireAuthResult {
  user: string | null;
  response: Response | null;
}

export async function requireAuth(
  req: Request,
  sessionSecret: string,
  opts: { jsonOn401?: boolean } = {},
): Promise<RequireAuthResult> {
  const user = await getAuthedUser(req, sessionSecret);
  if (user) return { user, response: null };
  if (opts.jsonOn401) {
    return {
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return {
    user: null,
    response: new Response(null, { status: 302, headers: { Location: '/admin/login.html' } }),
  };
}
