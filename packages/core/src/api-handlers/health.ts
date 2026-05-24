import type { Env } from '../types.js';

export async function handleHealth(_req: Request, env: Env): Promise<Response> {
  let dbReachable = false;
  try {
    await env.DB.prepare('SELECT 1').first();
    dbReachable = true;
  } catch {
    dbReachable = false;
  }

  return new Response(JSON.stringify({
    status: dbReachable ? 'ok' : 'degraded',
    environment: env.ENVIRONMENT,
    dbReachable,
    timestamp: Date.now(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
