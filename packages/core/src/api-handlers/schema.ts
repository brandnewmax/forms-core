import type { Env, FormSchema, FieldSchema } from '../types.js';
import { getLatestSchema } from '../db/queries.js';
import { corsHeaders } from '../cors.js';

function localize(value: string | Record<string, string> | undefined, lang: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (lang in value) return value[lang];
  const firstKey = Object.keys(value)[0];
  return firstKey ? value[firstKey] : undefined;
}

function localizeField(field: FieldSchema, lang: string): FieldSchema {
  return {
    ...field,
    label: localize(field.label, lang) ?? '',
    placeholder: localize(field.placeholder, lang),
    options: field.options?.map(o => ({
      value: o.value,
      label: localize(o.label, lang) ?? o.value,
    })),
  };
}

function localizeSchema(schema: FormSchema, lang: string): FormSchema {
  return {
    ...schema,
    fields: schema.fields.map(f => localizeField(f, lang)),
    submitButton: localize(schema.submitButton, lang) ?? '',
    successMessage: localize(schema.successMessage, lang),
  };
}

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

  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  const localized = localizeSchema(schema, lang);

  return new Response(JSON.stringify(localized), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      ...cors,
    },
  });
}
