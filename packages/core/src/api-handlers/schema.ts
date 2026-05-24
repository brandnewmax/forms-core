import type { Env } from '../types.js';
import { getLatestSchema } from '../db/queries.js';
import { corsHeaders } from '../cors.js';

export async function handleGetSchema(
  req: Request,
  env: Env,
  formId: string,
): Promise<Response> {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

  const schema = await getLatestSchema(env.DB, formId);
  if (!schema) {
    return new Response(JSON.stringify({ error: 'Form not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  // TODO Phase 1b: localize labels based on `?lang=` query param
  // Currently returns raw schema (i18n maps intact)

  return new Response(JSON.stringify(schema), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      ...cors,
    },
  });
}
