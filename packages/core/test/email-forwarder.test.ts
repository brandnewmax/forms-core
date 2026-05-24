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

  it('POSTs to MailChannels with personalizations + content', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 202 }));
    await sendSubmissionEmail(makeSubmission(), {
      toEmails: ['ops@mmldigi.com'],
      fromEmail: 'noreply@mmldigi.com',
      fromName: 'mmldigi forms',
      subject: 'New inquiry: contact',
    });
    expect(spy).toHaveBeenCalledWith(
      'https://api.mailchannels.net/tx/v1/send',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.personalizations[0].to[0].email).toBe('ops@mmldigi.com');
    expect(body.from.email).toBe('noreply@mmldigi.com');
    expect(body.subject).toBe('New inquiry: contact');
    expect(body.content[0].type).toBe('text/html');
  });

  it('returns { ok: true } on 202 success', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 202 }));
    const r = await sendSubmissionEmail(makeSubmission(), { toEmails: ['a@b.com'], fromEmail: 'x@y.com', fromName: 'x', subject: 's' });
    expect(r.ok).toBe(true);
  });

  it('returns { ok: false, status } on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('rejected', { status: 400 }));
    const r = await sendSubmissionEmail(makeSubmission(), { toEmails: ['a@b.com'], fromEmail: 'x@y.com', fromName: 'x', subject: 's' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('sends to multiple recipients', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(new Response('', { status: 202 }));
    await sendSubmissionEmail(makeSubmission(), {
      toEmails: ['a@b.com', 'c@d.com'],
      fromEmail: 'x@y.com', fromName: 'x', subject: 's',
    });
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.personalizations[0].to).toHaveLength(2);
  });
});
