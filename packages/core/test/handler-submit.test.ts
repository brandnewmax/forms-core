import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { handleSubmit } from '../src/api-handlers/submit.js';
import { unregisterAll, registerPlugin, listSubmissions } from '../src/index.js';

const baseEnv = { ...env, ALLOWED_ORIGINS: '*', ENVIRONMENT: 'development' } as any;

function makeReq(body: unknown, extraHeaders: Record<string, string> = {}): Request {
  return new Request('https://api.test/api/v1/forms/contact/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': '1.2.3.4',
      'cf-ipcountry': 'US',
      'user-agent': 'test-agent',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  fields: {
    name: 'John',
    email: 'john@test.com',
    company: 'Acme',
    message: 'Hello world',
  },
  context: {
    page_url: 'https://mmldigi.com/contact',
    referrer: 'https://google.com',
    utm: { source: 'google' },
  },
  _meta: {
    honeypot: '',
    time_on_form_ms: 5000,
  },
};

describe('handleSubmit', () => {
  beforeEach(async () => {
    unregisterAll();
    await env.DB.exec('DELETE FROM submissions');
    // Reset settings: clear notify_emails + webhooks so tests that don't care
    // about side-effects don't make real network calls (email/webhook tests set their own values).
    await env.DB.exec(`UPDATE forms_settings SET notify_emails = '[]', webhooks_json = '[]' WHERE form_id = 'contact'`);
    vi.restoreAllMocks();
  });

  it('returns 200 + persisted submission for valid input', async () => {
    const resp = await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.id).toMatch(/^[0-9A-Z]{26}$/);  // ULID
    const list = await listSubmissions(env.DB, { formId: 'contact' });
    expect(list.total).toBe(1);
    expect(list.items[0]!.fields.name).toBe('John');
    expect(list.items[0]!.context.ip).toBe('1.2.3.4');
    expect(list.items[0]!.context.ipCountry).toBe('US');
  });

  it('returns 400 for missing required field', async () => {
    const body = { ...validBody, fields: { ...validBody.fields, name: '' } };
    const resp = await handleSubmit(makeReq(body), baseEnv, 'contact');
    expect(resp.status).toBe(400);
    const j = await resp.json() as any;
    expect(j.errors).toContainEqual({ field: 'name', message: 'Required' });
  });

  it('returns 400 for honeypot filled (bot detected)', async () => {
    const body = { ...validBody, _meta: { honeypot: 'bot-was-here', time_on_form_ms: 5000 } };
    const resp = await handleSubmit(makeReq(body), baseEnv, 'contact');
    expect(resp.status).toBe(400);
  });

  it('returns 400 for time-on-form too short', async () => {
    const body = { ...validBody, _meta: { honeypot: '', time_on_form_ms: 500 } };
    const resp = await handleSubmit(makeReq(body), baseEnv, 'contact');
    expect(resp.status).toBe(400);
  });

  it('returns 429 after rate limit exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await handleSubmit(makeReq(validBody), baseEnv, 'contact');
      expect(r.status).toBe(200);
    }
    const blocked = await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    expect(blocked.status).toBe(429);
  });

  it('returns 404 for unknown form', async () => {
    const resp = await handleSubmit(makeReq(validBody), baseEnv, 'unknown-form');
    expect(resp.status).toBe(404);
  });

  it('returns 400 for non-JSON body', async () => {
    const req = new Request('https://api.test/api/v1/forms/contact/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'cf-connecting-ip': '9.9.9.9' },
      body: 'not json',
    });
    const resp = await handleSubmit(req, baseEnv, 'contact');
    expect(resp.status).toBe(400);
  });

  it('runs registered plugin hooks in pipeline order', async () => {
    const trace: string[] = [];
    registerPlugin({
      name: 'tracer', version: '1.0.0',
      beforeValidate: (ctx) => { trace.push('beforeValidate'); return ctx; },
      afterValidate: () => { trace.push('afterValidate'); },
      beforeStore: async () => { trace.push('beforeStore'); return { plugin_enriched: 'yes' }; },
      afterStore: async () => { trace.push('afterStore'); },
      beforeRespond: (resp) => { trace.push('beforeRespond'); return { ...resp, customMessage: 'thx' }; },
    });
    const resp = await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    const j = await resp.json() as any;
    expect(trace).toEqual(['beforeValidate', 'afterValidate', 'beforeStore', 'afterStore', 'beforeRespond']);
    expect(j.customMessage).toBe('thx');
    // enriched should have made it to DB
    const list = await listSubmissions(env.DB, { formId: 'contact' });
    expect(list.items[0]!.enriched).toEqual({ plugin_enriched: 'yes' });
  });

  it('plugin rejecting in beforeValidate returns 400 without storing', async () => {
    registerPlugin({
      name: 'spam-blocker', version: '1.0.0',
      beforeValidate: () => ({ reject: 'looks like spam' }),
    });
    const resp = await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    expect(resp.status).toBe(400);
    const j = await resp.json() as any;
    expect(j.error).toBe('looks like spam');
    const list = await listSubmissions(env.DB, { formId: 'contact' });
    expect(list.total).toBe(0);
  });

  it('sends notification email to settings.notifyEmails after successful submission', async () => {
    await env.DB.prepare(`UPDATE forms_settings SET notify_emails = ?1 WHERE form_id = 'contact'`)
      .bind(JSON.stringify(['ops@mmldigi.com'])).run();
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 202 }));
    await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    const mailCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('mailchannels.net'));
    expect(mailCalls).toHaveLength(1);
  });

  it('skips email when settings.notifyEmails is empty', async () => {
    await env.DB.prepare(`UPDATE forms_settings SET notify_emails = '[]' WHERE form_id = 'contact'`).run();
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
    await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    const mailCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('mailchannels.net'));
    expect(mailCalls).toHaveLength(0);
  });

  it('dispatches configured webhooks after successful submission', async () => {
    const webhooks = [
      { id: 'wc', url: 'https://wc.example.com/hook', payload_template: 'wecom_markdown' },
    ];
    await env.DB.prepare(`UPDATE forms_settings SET webhooks_json = ?1, notify_emails = '[]' WHERE form_id = 'contact'`)
      .bind(JSON.stringify(webhooks)).run();
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 200 }));
    await handleSubmit(makeReq(validBody), baseEnv, 'contact');
    const hookCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('wc.example.com'));
    expect(hookCalls).toHaveLength(1);
  });
});
