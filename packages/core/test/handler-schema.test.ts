import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { handleGetSchema } from '../src/api-handlers/schema.js';

describe('handleGetSchema', () => {
  const baseEnv = { ...env, ALLOWED_ORIGINS: '*' } as any;

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
});
