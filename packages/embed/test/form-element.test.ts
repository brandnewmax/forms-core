import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MmldigiForm, registerFormElement } from '../src/form-element.js';

const mockSchema = {
  formId: 'contact', version: 1, submitButton: 'Send',
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Name' },
    { name: 'email', type: 'email', required: true, label: 'Email' },
  ],
};

beforeEach(() => {
  registerFormElement();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

async function flushMicrotasks(times = 15) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('MmldigiForm Web Component', () => {
  it('is registered as <mmldigi-form>', () => {
    expect(customElements.get('mmldigi-form')).toBe(MmldigiForm);
  });

  it('fetches schema on connect using form-id + lang attrs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify(mockSchema), { status: 200 }),
    );
    const el = document.createElement('mmldigi-form') as MmldigiForm;
    el.setAttribute('form-id', 'contact');
    el.setAttribute('lang', 'en');
    el.setAttribute('api-base', 'https://forms.x.com');
    document.body.appendChild(el);

    await flushMicrotasks();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://forms.x.com/api/v1/forms/contact/schema?lang=en',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('renders the form DOM after schema fetch', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify(mockSchema), { status: 200 }),
    );
    const el = document.createElement('mmldigi-form') as MmldigiForm;
    el.setAttribute('form-id', 'contact');
    el.setAttribute('api-base', 'https://forms.x.com');
    document.body.appendChild(el);

    await flushMicrotasks();
    expect(el.querySelector('form.mf-form')).not.toBeNull();
    expect(el.querySelector('input[name="name"]')).not.toBeNull();
    expect(el.querySelector('input[name="email"]')).not.toBeNull();
  });

  it('shows an error state if schema fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const el = document.createElement('mmldigi-form') as MmldigiForm;
    el.setAttribute('form-id', 'missing');
    el.setAttribute('api-base', 'https://forms.x.com');
    document.body.appendChild(el);

    await flushMicrotasks();
    expect(el.textContent).toMatch(/unavailable|error/i);
  });

  it('submit POSTs and shows success message on 200', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockSchema), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'sub-1' }), { status: 200 }));

    const el = document.createElement('mmldigi-form') as MmldigiForm;
    el.setAttribute('form-id', 'contact');
    el.setAttribute('api-base', 'https://forms.x.com');
    document.body.appendChild(el);
    await flushMicrotasks();

    (el.querySelector('input[name="name"]') as HTMLInputElement).value = 'A';
    (el.querySelector('input[name="email"]') as HTMLInputElement).value = 'a@b.com';
    const form = el.querySelector('form') as HTMLFormElement;

    // Bypass time-trap: fake the renderedAt timestamp to 5s ago
    (el as any).renderedAt = Date.now() - 5000;

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flushMicrotasks(5);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]![0]).toBe('https://forms.x.com/api/v1/forms/contact/submissions');
    expect(el.querySelector('.mf-success-message')).not.toBeNull();
  });

  it('dispatches submit_success event with submissionId', async () => {
    vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockSchema), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'sub-77' }), { status: 200 }));

    const el = document.createElement('mmldigi-form') as MmldigiForm;
    el.setAttribute('form-id', 'contact');
    el.setAttribute('api-base', 'https://forms.x.com');
    document.body.appendChild(el);
    await flushMicrotasks();

    let captured: CustomEvent | null = null;
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail.type === 'submit_success') captured = e as CustomEvent;
    };
    window.addEventListener('mmldigi-form-event', handler);

    try {
      (el.querySelector('input[name="name"]') as HTMLInputElement).value = 'A';
      (el.querySelector('input[name="email"]') as HTMLInputElement).value = 'a@b.com';
      (el as any).renderedAt = Date.now() - 5000;
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await flushMicrotasks(5);

      expect(captured).not.toBeNull();
      expect(captured!.detail.submissionId).toBe('sub-77');
    } finally {
      window.removeEventListener('mmldigi-form-event', handler);
    }
  });

  it('shows inline field errors on 400 validation response', async () => {
    vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockSchema), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ errors: [{ field: 'name', message: 'Required' }] }),
        { status: 400 },
      ));

    const el = document.createElement('mmldigi-form') as MmldigiForm;
    el.setAttribute('form-id', 'contact');
    el.setAttribute('api-base', 'https://forms.x.com');
    document.body.appendChild(el);
    await flushMicrotasks();

    (el as any).renderedAt = Date.now() - 5000;
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await flushMicrotasks(5);

    const nameField = el.querySelector('.mf-field[data-field-name="name"]');
    expect(nameField?.getAttribute('data-invalid')).toBe('true');
    expect(nameField?.querySelector('.mf-error-message')?.textContent).toBe('Required');
  });
});
