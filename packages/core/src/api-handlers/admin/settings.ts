import type { Env } from '../../types.js';
import { getFormSettings, updateFormSettings, type UpdateSettingsInput } from '../../db/queries.js';

export async function handleGetSettings(_req: Request, env: Env, formId: string): Promise<Response> {
  const s = await getFormSettings(env.DB, formId);
  if (!s) {
    return new Response(JSON.stringify({ error: 'Form not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(s), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleUpdateSettings(req: Request, env: Env, formId: string): Promise<Response> {
  let body: UpdateSettingsInput;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  await updateFormSettings(env.DB, formId, body);
  return new Response(null, { status: 204 });
}
