import type { Env } from './types.js';

// hreflang (lowercase) → DeepL target_lang code
const DEEPL_TARGET: Record<string, string> = {
  es: 'ES', fr: 'FR', ru: 'RU', de: 'DE', ja: 'JA', it: 'IT', pt: 'PT-PT', nl: 'NL', pl: 'PL', zh: 'ZH',
};

export function isDeeplConfigured(env: Env): boolean {
  return Boolean(env.DEEPL_API_KEY);
}

/** Batch-translate `texts` into `targetLang` (a hreflang code like 'es'). Source assumed English. */
export async function translateTexts(texts: string[], targetLang: string, env: Env): Promise<string[]> {
  if (!env.DEEPL_API_KEY) throw new Error('DEEPL_API_KEY not configured');
  if (texts.length === 0) return [];
  const base = (env.DEEPL_SERVER_URL || 'https://api.deepl.com')
    .replace(/\/v2\/?$/, '')
    .replace(/\/$/, '');
  const target = DEEPL_TARGET[targetLang.toLowerCase()] ?? targetLang.toUpperCase();
  const resp = await fetch(`${base}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts, target_lang: target, source_lang: 'EN' }),
  });
  if (!resp.ok) throw new Error(`DeepL ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { translations: Array<{ text: string }> };
  return data.translations.map((t) => t.text);
}
