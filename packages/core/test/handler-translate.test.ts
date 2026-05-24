import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTranslateSchema } from '../src/index.js';
import type { Env, FormSchema } from '../src/index.js';

function env(over: Partial<Env> = {}): Env {
  return { DB: {} as any, RATE_LIMIT_KV: {} as any, ALLOWED_ORIGINS: '*', ENVIRONMENT: 'development', ...over };
}
function schema(): FormSchema {
  return { formId: 'contact', version: 1, fields: [{ name: 'c', type: 'text', label: 'Company' }], submitButton: 'Send' };
}
function post(body: unknown): Request {
  return new Request('https://api/x', { method: 'POST', body: JSON.stringify(body) });
}
// DeepL mock: echo each requested text, tagged with the target_lang from the body.
function deeplEcho(_url: any, init: any): Response {
  const parsed = JSON.parse(init.body);
  const texts = parsed.text as string[];
  const target = parsed.target_lang as string;
  return new Response(JSON.stringify({ translations: texts.map((t) => ({ text: `${target}:${t}` })) }), { status: 200 });
}

const SITE_HTML = `<link rel="alternate" hreflang="es" href="/es/"><link rel="alternate" hreflang="fr" href="/fr/">`;

beforeEach(() => vi.restoreAllMocks());

describe('handleTranslateSchema', () => {
  it('501 when DeepL not configured', async () => {
    const r = await handleTranslateSchema(post({ schema: schema() }), env(), 'contact');
    expect(r.status).toBe(501);
    expect((await r.json() as any).error).toContain('DEEPL_API_KEY');
  });

  it('400 when schema missing', async () => {
    const r = await handleTranslateSchema(post({}), env({ DEEPL_API_KEY: 'k' }), 'contact');
    expect(r.status).toBe(400);
  });

  it('400 when no targetLangs and no SITE_URL', async () => {
    const r = await handleTranslateSchema(post({ schema: schema() }), env({ DEEPL_API_KEY: 'k' }), 'contact');
    expect(r.status).toBe(400);
    expect((await r.json() as any).error).toContain('SITE_URL');
  });

  it('discovers langs from SITE_URL then translates, returning augmented schema (no save)', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      if (String(url).includes('/v2/translate')) return deeplEcho(url, init);
      return new Response(SITE_HTML, { status: 200 }); // site fetch
    });
    const r = await handleTranslateSchema(
      post({ schema: schema() }),
      env({ DEEPL_API_KEY: 'k', SITE_URL: 'https://site/' }),
      'contact',
    );
    expect(r.status).toBe(200);
    const j = await r.json() as { schema: FormSchema; targetLangs: string[] };
    expect(j.targetLangs).toEqual(['es', 'fr']);
    expect(j.schema.fields[0]!.label).toEqual({ en: 'Company', es: 'ES:Company', fr: 'FR:Company' });
  });

  it('uses explicit targetLangs from body without fetching the site', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      if (String(url).includes('/v2/translate')) return deeplEcho(url, init);
      throw new Error('should not fetch site');
    });
    const r = await handleTranslateSchema(
      post({ schema: schema(), targetLangs: ['es'] }),
      env({ DEEPL_API_KEY: 'k' }),
      'contact',
    );
    expect(r.status).toBe(200);
    expect(spy.mock.calls.every((c: any[]) => String(c[0]).includes('/v2/translate'))).toBe(true);
  });
});
