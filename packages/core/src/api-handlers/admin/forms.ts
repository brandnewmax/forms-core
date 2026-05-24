import type { Env } from '../../types.js';
import {
  listForms, createForm, createSchemaVersion, getLatestSchema,
} from '../../db/queries.js';

export async function handleListForms(_req: Request, env: Env): Promise<Response> {
  const forms = await listForms(env.DB);
  return new Response(JSON.stringify(forms), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleCreateForm(req: Request, env: Env): Promise<Response> {
  let body: { id?: string; name?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON'); }
  if (!body.id || !body.name) return jsonErr(400, 'id and name required');
  await createForm(env.DB, body.id, body.name);
  return new Response(JSON.stringify({ id: body.id, name: body.name }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleCreateSchemaVersion(req: Request, env: Env, formId: string, createdBy: string | null): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON'); }
  const schemaJson = JSON.stringify(body);
  const version = await createSchemaVersion(env.DB, formId, schemaJson, createdBy);
  return new Response(JSON.stringify({ formId, version }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleGetCurrentSchema(_req: Request, env: Env, formId: string): Promise<Response> {
  const schema = await getLatestSchema(env.DB, formId);
  if (!schema) return jsonErr(404, 'Form not found');
  return new Response(JSON.stringify(schema), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export { handleGetSettings, handleUpdateSettings } from './settings.js';

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });
}
