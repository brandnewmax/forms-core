import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleListSubmissions } from '../src/api-handlers/admin/list-submissions.js';
import { insertSubmission } from '../src/index.js';
import type { Submission } from '../src/index.js';

const baseEnv = { ...env, ALLOWED_ORIGINS: '*', ENVIRONMENT: 'development' } as any;

function makeSub(id: string, overrides: Partial<Submission> = {}): Submission {
  return {
    id, formId: 'contact', schemaVersion: 1, lang: 'en',
    fields: { name: `name-${id}`, email: `${id}@test.com` },
    enriched: {}, createdAt: Date.now(),
    context: { ip: '1.2.3.4', ipCountry: 'US', userAgent: '', referrer: '', pageUrl: '', utm: {} },
    ...overrides,
  };
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM submissions');
});

describe('handleListSubmissions', () => {
  it('returns items + total in JSON', async () => {
    await insertSubmission(env.DB, makeSub('a'));
    await insertSubmission(env.DB, makeSub('b'));
    const resp = await handleListSubmissions(new Request('https://api.test/admin/api/submissions'), baseEnv);
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it('filters by form_id', async () => {
    await insertSubmission(env.DB, makeSub('a', { formId: 'contact' }));
    await env.DB.prepare(`INSERT INTO forms (id, name, active, created_at, updated_at) VALUES ('rfq', 'RFQ', 1, ?1, ?1)`)
      .bind(Date.now()).run();
    await insertSubmission(env.DB, makeSub('b', { formId: 'rfq' }));
    const resp = await handleListSubmissions(new Request('https://api.test/admin/api/submissions?form_id=rfq'), baseEnv);
    const body = await resp.json() as any;
    expect(body.total).toBe(1);
    expect(body.items[0].formId).toBe('rfq');
  });

  it('paginates with limit + offset', async () => {
    for (let i = 0; i < 12; i++) await insertSubmission(env.DB, makeSub(`s-${i}`, { createdAt: 1_700_000_000 + i }));
    const r1 = await handleListSubmissions(new Request('https://api.test/admin/api/submissions?limit=5&offset=0'), baseEnv);
    const b1 = await r1.json() as any;
    expect(b1.items).toHaveLength(5);
    expect(b1.total).toBe(12);
    const r2 = await handleListSubmissions(new Request('https://api.test/admin/api/submissions?limit=5&offset=10'), baseEnv);
    const b2 = await r2.json() as any;
    expect(b2.items).toHaveLength(2);
  });

  it('returns CSV when format=csv', async () => {
    await insertSubmission(env.DB, makeSub('csv1'));
    const resp = await handleListSubmissions(new Request('https://api.test/admin/api/submissions?format=csv'), baseEnv);
    expect(resp.headers.get('Content-Type')).toMatch(/text\/csv/);
    expect(resp.headers.get('Content-Disposition')).toMatch(/attachment/);
    const text = await resp.text();
    expect(text.split('\n')[0]).toContain('id');
    expect(text).toContain('csv1');
  });
});
