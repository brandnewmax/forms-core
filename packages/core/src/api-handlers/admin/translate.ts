import type { Env, FormSchema } from '../../types.js';
import { isDeeplConfigured, translateTexts } from '../../deepl.js';
import { discoverSiteLangs } from '../../i18n-targets.js';
import { translateSchema } from '../../translate-schema.js';

/**
 * POST body: { schema: FormSchema, targetLangs?: string[] }
 * Returns { schema, targetLangs } — the augmented schema for the editor to
 * review. Does NOT persist; the existing "create schema version" route saves.
 */
export async function handleTranslateSchema(req: Request, env: Env, _formId: string): Promise<Response> {
  if (!isDeeplConfigured(env)) return jsonErr(501, 'Translation not configured (DEEPL_API_KEY missing)');

  let body: { schema?: FormSchema; targetLangs?: string[] };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON'); }
  if (!body.schema || !Array.isArray(body.schema.fields)) return jsonErr(400, 'schema required');

  let targetLangs = body.targetLangs;
  if (!targetLangs || targetLangs.length === 0) {
    if (!env.SITE_URL) return jsonErr(400, 'No targetLangs provided and SITE_URL not set');
    try { targetLangs = await discoverSiteLangs(env.SITE_URL); }
    catch (e) { return jsonErr(502, `Could not read site languages: ${(e as Error).message}`); }
  }
  if (targetLangs.length === 0) return jsonErr(400, 'No target languages found');

  let translated: FormSchema;
  try {
    translated = await translateSchema(body.schema, targetLangs, (texts, lang) => translateTexts(texts, lang, env));
  } catch (e) { return jsonErr(502, `Translation failed: ${(e as Error).message}`); }

  return new Response(JSON.stringify({ schema: translated, targetLangs }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function jsonErr(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });
}
