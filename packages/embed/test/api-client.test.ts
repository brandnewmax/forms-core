import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchSchema, postSubmission } from '../src/api-client.js';

describe('fetchSchema', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('GETs /api/v1/forms/:id/schema?lang=', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ formId: 'contact', version: 1, fields: [], submitButton: 'Send' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }),
    );
    await fetchSchema('https://forms.x.com', 'contact', 'en');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://forms.x.com/api/v1/forms/contact/schema?lang=en',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns parsed schema on 200', async () => {
    const schema = { formId: 'contact', version: 1, fields: [], submitButton: 'Send' };
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify(schema), { status: 200 }),
    );
    const got = await fetchSchema('https://forms.x.com', 'contact', 'en');
    expect(got).toEqual(schema);
  });

  it('throws with status text on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'not found' }), { status: 404 }),
    );
    await expect(fetchSchema('https://x.com', 'missing', 'en')).rejects.toThrow(/404/);
  });
});

describe('postSubmission', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('POSTs JSON body to /api/v1/forms/:id/submissions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub-1' }), { status: 200 }),
    );
    const payload = {
      fields: { name: 'A' },
      context: { page_url: 'https://test.com', utm: {} },
      _meta: { honeypot: '', time_on_form_ms: 5000 },
    };
    await postSubmission('https://forms.x.com', 'contact', payload);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://forms.x.com/api/v1/forms/contact/submissions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      }),
    );
  });

  it('returns parsed response on 200', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub-1', score: 87 }), { status: 200 }),
    );
    const got = await postSubmission('https://x.com', 'contact', { fields: {}, context: { page_url: '', utm: {} }, _meta: { honeypot: '', time_on_form_ms: 5000 } });
    expect(got.ok).toBe(true);
    expect(got.body).toEqual({ id: 'sub-1', score: 87 });
  });

  it('returns ok:false + errors on 400 validation', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ field: 'name', message: 'Required' }] }), { status: 400 }),
    );
    const got = await postSubmission('https://x.com', 'contact', { fields: {}, context: { page_url: '', utm: {} }, _meta: { honeypot: '', time_on_form_ms: 5000 } });
    expect(got.ok).toBe(false);
    expect(got.status).toBe(400);
    expect(got.body).toHaveProperty('errors');
  });
});
