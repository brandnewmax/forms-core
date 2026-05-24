import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  insertSubmission,
  getSubmission,
  listSubmissions,
  getLatestSchema,
  getFormSettings,
} from '../src/db/queries.js';
import type { Submission } from '../src/index.js';

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 'sub-test-1',
    formId: 'contact',
    schemaVersion: 1,
    lang: 'en',
    fields: { name: 'John', email: 'j@test.com' },
    enriched: {},
    context: {
      ip: '1.2.3.4', ipCountry: 'US', userAgent: 'test',
      referrer: '', pageUrl: 'https://t.com', utm: {},
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('db queries', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM submissions');
  });

  it('inserts and retrieves a submission', async () => {
    const sub = makeSubmission();
    await insertSubmission(env.DB, sub);
    const retrieved = await getSubmission(env.DB, sub.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(sub.id);
    expect(retrieved!.fields).toEqual({ name: 'John', email: 'j@test.com' });
    expect(retrieved!.context.ip).toBe('1.2.3.4');
  });

  it('returns null for non-existent submission', async () => {
    const r = await getSubmission(env.DB, 'nonexistent');
    expect(r).toBeNull();
  });

  it('lists submissions filtered by form_id, paginated', async () => {
    for (let i = 0; i < 7; i++) {
      await insertSubmission(env.DB, makeSubmission({ id: `s-${i}`, createdAt: Date.now() + i }));
    }
    const page = await listSubmissions(env.DB, { formId: 'contact', limit: 5, offset: 0 });
    expect(page.items).toHaveLength(5);
    expect(page.total).toBe(7);
  });

  it('lists submissions filtered by date range', async () => {
    const t0 = 1_700_000_000_000;
    await insertSubmission(env.DB, makeSubmission({ id: 'old', createdAt: t0 }));
    await insertSubmission(env.DB, makeSubmission({ id: 'new', createdAt: t0 + 10_000 }));
    const page = await listSubmissions(env.DB, { formId: 'contact', from: t0 + 5_000 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.id).toBe('new');
  });

  it('getLatestSchema returns highest version for form_id', async () => {
    const s = await getLatestSchema(env.DB, 'contact');
    expect(s).not.toBeNull();
    expect(s!.formId).toBe('contact');
    expect(s!.version).toBe(1);
    expect(s!.fields).toHaveLength(4);
  });

  it('getFormSettings returns defaults seeded for contact', async () => {
    const settings = await getFormSettings(env.DB, 'contact');
    expect(settings).not.toBeNull();
    expect(settings!.notifyEmails).toEqual(['dev@example.com']);
    expect(settings!.spamMinTimeMs).toBe(3000);
    expect(settings!.rateLimitPerIp).toBe(5);
  });
});
