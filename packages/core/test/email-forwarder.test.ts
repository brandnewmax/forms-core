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

  it('renders a Browsing path section when journey is present, escaped', () => {
    const sub = makeSubmission({
      context: {
        ip: '1.2.3.4', userAgent: 'UA', referrer: '', pageUrl: 'https://m.com/c', utm: {},
        journey: [
          { url: '/products', title: 'Products', ts: 1716540000000 },
          { url: '/p<script>', title: 'x', ts: 1716540060000 },
        ],
      },
    });
    const html = buildEmailHtml(sub);
    expect(html).toContain('Browsing path');
    expect(html).toContain('/products');
    expect(html).toContain('Products');
    expect(html).not.toContain('/p<script>');
    expect(html).toContain('/p&lt;script&gt;');
  });

  it('omits the Browsing path section when journey is absent or empty', () => {
    expect(buildEmailHtml(makeSubmission())).not.toContain('Browsing path');
  });

  it('shows per-page dwell from arrival deltas and submit time for the last page', () => {
    const sub = makeSubmission({
      createdAt: 10000,
      context: {
        ip: '1.2.3.4', userAgent: 'UA', referrer: '', pageUrl: '/c', utm: {},
        journey: [
          { url: '/a', title: 'A', ts: 1000 },
          { url: '/b', title: 'B', ts: 4000 },
          { url: '/c', title: 'C', ts: 5000 },
        ],
      },
    });
    const html = buildEmailHtml(sub);
    // /a: 4000-1000=3000ms="3s"; /b: 5000-4000=1000ms="1s"; /c(last): 10000-5000=5000ms="5s"
    expect(html).toContain('>3s<');
    expect(html).toContain('>1s<');
    expect(html).toContain('>5s<');
    expect(html).toContain('(→ submitted)');
    expect(html).toContain('3 pages');
    expect(html).toContain('started 00:00:01 UTC'); // ts=1000ms → 00:00:01
  });

  it('clamps negative last-page dwell (clock skew) to <1s', () => {
    const sub = makeSubmission({
      createdAt: 500,
      context: { ip: '1.2.3.4', userAgent: 'UA', referrer: '', pageUrl: '/a', utm: {},
        journey: [{ url: '/a', ts: 1000 }] },
    });
    expect(buildEmailHtml(sub)).toContain('<1s');
  });

  it('formats minute-scale dwell', () => {
    const sub = makeSubmission({
      createdAt: 999999999,
      context: { ip: '1.2.3.4', userAgent: 'UA', referrer: '', pageUrl: '/a', utm: {},
        journey: [{ url: '/a', ts: 0 }, { url: '/b', ts: 65000 }] },
    });
    // /a dwell = 65000ms → "1m 5s"
    expect(buildEmailHtml(sub)).toContain('1m 5s');
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
