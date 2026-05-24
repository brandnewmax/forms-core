import type { FormSchema } from './types.js';

export type Translator = (texts: string[], lang: string) => Promise<string[]>;

type I18nMap = Record<string, string>;

/**
 * Return a deep copy of `schema` with every translatable slot normalized to an
 * i18n map and missing `targetLangs` filled via `translate`. Existing
 * translations and the `en` source are preserved. Input is not mutated.
 */
export async function translateSchema(
  schema: FormSchema,
  targetLangs: string[],
  translate: Translator,
): Promise<FormSchema> {
  const out: FormSchema = JSON.parse(JSON.stringify(schema));
  const refs: I18nMap[] = []; // live references into `out`

  const norm = (v: string | I18nMap | undefined): I18nMap | undefined => {
    if (v === undefined) return undefined;
    const map: I18nMap = typeof v === 'string' ? { en: v } : { ...v };
    if (!('en' in map)) {
      const first = Object.values(map)[0];
      if (first !== undefined) map.en = first;
    }
    refs.push(map);
    return map;
  };

  out.submitButton = norm(out.submitButton)!;
  if (out.successMessage !== undefined) out.successMessage = norm(out.successMessage);
  for (const f of out.fields) {
    f.label = norm(f.label)!;
    if (f.placeholder !== undefined) f.placeholder = norm(f.placeholder);
    if (f.options) for (const o of f.options) o.label = norm(o.label)!;
  }

  for (const lang of targetLangs) {
    const todo = refs.filter((m) => m.en && !m[lang]);
    if (todo.length === 0) continue;
    const translated = await translate(todo.map((m) => m.en!), lang);
    todo.forEach((m, i) => { m[lang] = translated[i]!; });
  }

  return out;
}
