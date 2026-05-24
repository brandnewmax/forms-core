import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleGetSubmission } from '../src/api-handlers/admin/get-submission.js';
import { insertSubmission } from '../src/index.js';

const baseEnv = { ...env, ALLOWED_ORIGINS: '*', ENVIRONMENT: 'development' } as any;

beforeEach(async () => { await env.DB.exec('DELETE FROM submissions'); });

describe('handleGetSubmission', () => {
  it('returns 200 + full submission for existing id', async () => {
    await insertSubmission(env.DB, {
      id: 'sub-abc', formId: 'contact', schemaVersion: 1, lang: 'en',
      fields: { name: 'Test' }, enriched: {}, createdAt: 1716543600000,
      context: { ip: '1.2.3.4', userAgent: '', referrer: '', pageUrl: 'https://x', utm: {} },
    });
    const resp = await handleGetSubmission(new Request('https://api.test/admin/api/submissions/sub-abc'), baseEnv, 'sub-abc');
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.id).toBe('sub-abc');
    expect(body.fields.name).toBe('Test');
  });

  it('returns 404 for non-existent id', async () => {
    const resp = await handleGetSubmission(new Request('https://api.test/admin/api/submissions/missing'), baseEnv, 'missing');
    expect(resp.status).toBe(404);
  });
});
