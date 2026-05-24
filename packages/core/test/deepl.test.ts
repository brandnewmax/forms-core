import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDeeplConfigured, translateTexts } from '../src/deepl.js';
import type { Env } from '../src/index.js';

function env(over: Partial<Env> = {}): Env {
  return { DB: {} as any, RATE_LIMIT_KV: {} as any, ALLOWED_ORIGINS: '*', ENVIRONMENT: 'development', ...over };
}

beforeEach(() => vi.restoreAllMocks());

describe('isDeeplConfigured', () => {
  it('false when no key', () => expect(isDeeplConfigured(env())).toBe(false));
  it('true when key present', () => expect(isDeeplConfigured(env({ DEEPL_API_KEY: 'k' }))).toBe(true));
});

describe('translateTexts', () => {
  it('throws without key', async () => {
    await expect(translateTexts(['Hi'], 'es', env())).rejects.toThrow('DEEPL_API_KEY');
  });

  it('returns [] for empty input without calling fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any);
    expect(await translateTexts([], 'es', env({ DEEPL_API_KEY: 'k' }))).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('POSTs to <server>/v2/translate with auth header, maps lang code, returns texts', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ translations: [{ text: 'Empresa' }, { text: 'Correo' }] }), { status: 200 }),
    );
    const out = await translateTexts(['Company', 'Email'], 'es', env({ DEEPL_API_KEY: 'k', DEEPL_SERVER_URL: 'https://api.deepl-pro.com' }));
    expect(out).toEqual(['Empresa', 'Correo']);
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://api.deepl-pro.com/v2/translate');
    expect((init as any).headers['Authorization']).toBe('DeepL-Auth-Key k');
    const body = JSON.parse((init as any).body);
    expect(body).toEqual({ text: ['Company', 'Email'], target_lang: 'ES', source_lang: 'EN' });
  });

  it('strips trailing /v2 from server url and defaults when unset', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ translations: [{ text: 'x' }] }), { status: 200 }),
    );
    await translateTexts(['a'], 'fr', env({ DEEPL_API_KEY: 'k', DEEPL_SERVER_URL: 'https://api.deepl-pro.com/v2/' }));
    expect(spy.mock.calls[0]![0]).toBe('https://api.deepl-pro.com/v2/translate');
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('quota', { status: 456 }));
    await expect(translateTexts(['a'], 'es', env({ DEEPL_API_KEY: 'k' }))).rejects.toThrow('DeepL 456');
  });
});
