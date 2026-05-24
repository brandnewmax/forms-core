import type { Env } from '../../types.js';
import { getSubmission } from '../../db/queries.js';

export async function handleGetSubmission(_req: Request, env: Env, id: string): Promise<Response> {
  const sub = await getSubmission(env.DB, id);
  if (!sub) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(sub), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
