import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchWebhook, type WebhookConfig } from '../src/webhook-dispatcher.js';
import type { Submission } from '../src/index.js';

function makeSub(): Submission {
  return {
    id: '01HXX', formId: 'contact', schemaVersion: 1, lang: 'en',
    fields: { name: 'John', email: 'j@test.com', message: 'Hi' },
    enriched: {}, createdAt: 1716543600000,
    context: {
      ip: '1.2.3.4', ipCountry: 'US', userAgent: 'M', referrer: '',
      pageUrl: 'https://x.com/y', utm: {},
    },
  };
}

beforeEach(() => vi.restoreAllMocks());

describe('dispatchWebhook', () => {
  it('raw template POSTs full Submission JSON', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 200 }));
    const cfg: WebhookConfig = { id: 'crm-1', url: 'https://crm.example.com/leads', payload_template: 'raw' };
    await dispatchWebhook(makeSub(), cfg);
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.id).toBe('01HXX');
    expect(body.fields.name).toBe('John');
    expect(body.context.pageUrl).toBe('https://x.com/y');
  });

  it('wecom_markdown template formats for WeCom bot', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 200 }));
    const cfg: WebhookConfig = { id: 'wc-1', url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=x', payload_template: 'wecom_markdown' };
    await dispatchWebhook(makeSub(), cfg);
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.msgtype).toBe('markdown');
    expect(body.markdown.content).toContain('John');
    expect(body.markdown.content).toContain('j@test.com');
    expect(body.markdown.content).toContain('contact');
  });

  it('dingtalk_text template formats for DingTalk bot', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 200 }));
    const cfg: WebhookConfig = { id: 'dt-1', url: 'https://oapi.dingtalk.com/robot/send?access_token=y', payload_template: 'dingtalk_text' };
    await dispatchWebhook(makeSub(), cfg);
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.msgtype).toBe('text');
    expect(body.text.content).toContain('John');
    expect(body.text.content).toContain('contact');
  });

  it('returns ok:true on 200, ok:false on 5xx', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 200 }));
    const ok = await dispatchWebhook(makeSub(), { id: 'a', url: 'https://x.com', payload_template: 'raw' });
    expect(ok.ok).toBe(true);

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('err', { status: 503 }));
    const fail = await dispatchWebhook(makeSub(), { id: 'a', url: 'https://x.com', payload_template: 'raw' });
    expect(fail.ok).toBe(false);
    expect(fail.status).toBe(503);
  });

  it('catches network errors and returns ok:false without throwing', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new TypeError('fetch failed'));
    const r = await dispatchWebhook(makeSub(), { id: 'a', url: 'https://x.com', payload_template: 'raw' });
    expect(r.ok).toBe(false);
    expect(r.status).toBeUndefined();
  });
});
