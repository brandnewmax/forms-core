import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSubmissionEmail, buildEmailHtml } from '../src/email-forwarder.js';
import type { Submission } from '../src/index.js';

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: '01HXX', formId: 'contact', schemaVersion: 1, lang: 'en',
    fields: { name: 'John', email: 'j@test.com', message: 'Hello' },
    enriched: {}, createdAt: 1716543600000,
    context: {
      ip: '1.2.3.4', ipCountry: 'US', userAgent: 'Mozilla/5.0', referrer: '',
      pageUrl: 'https://mmldigi.com/contact', utm: { source: 'google' },
    },
    ...overrides,
  };
}

describe('buildEmailHtml', () => {
  it('includes form id, submission id, all fields, IP country, page URL', () => {
    const html = buildEmailHtml(makeSubmission());
    expect(html).toContain('contact');
    expect(html).toContain('01HXX');
    expect(html).toContain('John');
    expect(html).toContain('j@test.com');
    expect(html).toContain('Hello');
    expect(html).toContain('US');
    expect(html).toContain('mmldigi.com/contact');
    expect(html).toContain('google');
  });

  it('escapes HTML in field values to prevent injection', () => {
    const sub = makeSubmission({ fields: { name: '<script>alert(1)</script>' } });
    const html = buildEmailHtml(sub);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('sendSubmissionEmail', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('POSTs to Resend with bearer auth + from/to/subject/html', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
    await sendSubmissionEmail(makeSubmission(), {
      toEmails: ['ops@mmldigi.com'],
      fromEmail: 'onboarding@resend.dev',
      fromName: 'mmldigi forms',
      subject: 'New inquiry: contact',
      apiKey: 're_test_key',
    });
    expect(spy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = spy.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer re_test_key');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['ops@mmldigi.com']);
    expect(body.from).toBe('mmldigi forms <onboarding@resend.dev>');
    expect(body.subject).toBe('New inquiry: contact');
    expect(body.html).toContain('contact');
  });

  it('returns { ok: true } on 200 success', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
    const r = await sendSubmissionEmail(makeSubmission(), { toEmails: ['a@b.com'], fromEmail: 'x@y.com', fromName: 'x', subject: 's', apiKey: 'k' });
    expect(r.ok).toBe(true);
  });

  it('returns { ok: false, status } on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('rejected', { status: 422 }));
    const r = await sendSubmissionEmail(makeSubmission(), { toEmails: ['a@b.com'], fromEmail: 'x@y.com', fromName: 'x', subject: 's', apiKey: 'k' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(422);
  });

  it('sends to multiple recipients', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
    await sendSubmissionEmail(makeSubmission(), {
      toEmails: ['a@b.com', 'c@d.com'],
      fromEmail: 'x@y.com', fromName: 'x', subject: 's', apiKey: 'k',
    });
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.to).toHaveLength(2);
  });
});
