import { describe, it, expect } from 'vitest';
import { translateSchema, type Translator } from '../src/translate-schema.js';
import type { FormSchema } from '../src/index.js';

// fake translator: deterministic, records which langs were requested
function fakeTranslator(seen: string[]): Translator {
  return async (texts, lang) => { seen.push(lang); return texts.map((t) => `${lang}:${t}`); };
}

function schema(): FormSchema {
  return {
    formId: 'contact', version: 1,
    fields: [
      { name: 'company', type: 'text', label: 'Company', placeholder: 'Your company' },
      { name: 'topic', type: 'select', label: { en: 'Topic', es: 'Tema' }, options: [
        { value: 'sales', label: 'Sales' }, { value: 'support', label: 'Support' },
      ] },
    ],
    submitButton: 'Send', successMessage: 'Thanks',
  };
}

describe('translateSchema', () => {
  it('fills missing langs into i18n maps for every translatable slot', async () => {
    const seen: string[] = [];
    const out = await translateSchema(schema(), ['es', 'fr'], fakeTranslator(seen));
    const company = out.fields[0]!;
    expect(company.label).toEqual({ en: 'Company', es: 'es:Company', fr: 'fr:Company' });
    expect(company.placeholder).toEqual({ en: 'Your company', es: 'es:Your company', fr: 'fr:Your company' });
    expect(out.submitButton).toEqual({ en: 'Send', es: 'es:Send', fr: 'fr:Send' });
    expect(out.successMessage).toEqual({ en: 'Thanks', es: 'es:Thanks', fr: 'fr:Thanks' });
    expect(out.fields[1]!.options![0]!.label).toEqual({ en: 'Sales', es: 'es:Sales', fr: 'fr:Sales' });
  });

  it('preserves existing translations and never re-requests them', async () => {
    const seen: string[] = [];
    const out = await translateSchema(schema(), ['es'], fakeTranslator(seen));
    // topic.label already had es:'Tema' — must be kept, not overwritten
    expect(out.fields[1]!.label).toEqual({ en: 'Topic', es: 'Tema' });
  });

  it('does not mutate the input schema', async () => {
    const input = schema();
    await translateSchema(input, ['es'], fakeTranslator([]));
    expect(input.fields[0]!.label).toBe('Company'); // still a plain string
  });

  it('skips a target lang with nothing to translate (no translator call)', async () => {
    const seen: string[] = [];
    const allEs: FormSchema = {
      formId: 'c', version: 1, fields: [{ name: 'a', type: 'text', label: { en: 'A', es: 'A-es' } }],
      submitButton: { en: 'S', es: 'S-es' },
    };
    await translateSchema(allEs, ['es'], fakeTranslator(seen));
    expect(seen).toEqual([]); // nothing missing → translator never called
  });
});
