import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleGetSchema } from '../src/api-handlers/schema.js';

describe('handleGetSchema', () => {
  const baseEnv = { ...env, ALLOWED_ORIGINS: '*' } as any;

  beforeEach(async () => {
    // Reset schema_versions to only the seed (version 1) for predictable tests
    await env.DB.exec("DELETE FROM schema_versions WHERE form_id = 'contact' AND version > 1");
  });

  it('returns 200 + schema for existing form', async () => {
    const req = new Request('https://api.test/api/v1/forms/contact/schema?lang=en');
    const resp = await handleGetSchema(req, baseEnv, 'contact');
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.formId).toBe('contact');
    expect(body.fields).toHaveLength(4);
  });

  it('returns 404 for unknown form', async () => {
    const req = new Request('https://api.test/api/v1/forms/nonexistent/schema');
    const resp = await handleGetSchema(req, baseEnv, 'nonexistent');
    expect(resp.status).toBe(404);
  });

  it('includes CORS headers', async () => {
    const req = new Request('https://api.test/api/v1/forms/contact/schema', {
      headers: { Origin: 'https://mmldigi.com' },
    });
    const resp = await handleGetSchema(req, baseEnv, 'contact');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('https://mmldigi.com');
  });

  it('localizes string|i18n labels using lang param', async () => {
    await env.DB.prepare(`
      INSERT INTO schema_versions (form_id, version, schema_json, created_at)
      VALUES ('contact', 2, ?, ?)
    `).bind(JSON.stringify({
      formId: 'contact',
      version: 2,
      submitButton: { en: 'Send', es: 'Enviar' },
      fields: [{ name: 'q', type: 'text', label: { en: 'Question', es: 'Pregunta' } }],
    }), Date.now()).run();

    const req = new Request('https://api.test/api/v1/forms/contact/schema?lang=es');
    const resp = await handleGetSchema(req, baseEnv, 'contact');
    const body = await resp.json() as any;
    expect(body.fields[0].label).toBe('Pregunta');
    expect(body.submitButton).toBe('Enviar');
  });

  it('falls back to first available lang key when requested lang missing', async () => {
    await env.DB.prepare(`
      INSERT INTO schema_versions (form_id, version, schema_json, created_at)
      VALUES ('contact', 2, ?, ?)
    `).bind(JSON.stringify({
      formId: 'contact',
      version: 2,
      submitButton: { en: 'Send', es: 'Enviar' },
      fields: [{ name: 'q', type: 'text', label: { en: 'Question', es: 'Pregunta' } }],
    }), Date.now()).run();

    const req = new Request('https://api.test/api/v1/forms/contact/schema?lang=fr');
    const resp = await handleGetSchema(req, baseEnv, 'contact');
    const body = await resp.json() as any;
    expect(body.fields[0].label).toBe('Question');
  });

  it('passes through plain-string labels unchanged regardless of lang', async () => {
    await env.DB.prepare(`
      INSERT INTO schema_versions (form_id, version, schema_json, created_at)
      VALUES ('contact', 3, ?, ?)
    `).bind(JSON.stringify({
      formId: 'contact',
      version: 3,
      submitButton: 'Send',
      fields: [{ name: 'name', type: 'text', label: 'Name' }],
    }), Date.now()).run();

    const req = new Request('https://api.test/api/v1/forms/contact/schema?lang=es');
    const resp = await handleGetSchema(req, baseEnv, 'contact');
    const body = await resp.json() as any;
    expect(body.fields[0].label).toBe('Name');
    expect(body.submitButton).toBe('Send');
  });
});
