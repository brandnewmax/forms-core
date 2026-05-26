import { renderForm, type RenderedForm } from './renderer.js';
import { fetchSchema, postSubmission } from './api-client.js';
import { dispatchFormEvent } from './events.js';
import { readJourney } from './journey.js';
import type { FormSchema } from '@mmldigi/forms-core';

const TAG = 'mmldigi-form';

export class MmldigiForm extends HTMLElement {
  /** Exposed as `any` in tests to fake the timestamp — must be public-ish */
  renderedAt = 0;
  private schema: FormSchema | null = null;
  private rendered: RenderedForm | null = null;
  private startFired = false;

  static get observedAttributes(): string[] {
    return ['form-id', 'lang', 'api-base'];
  }

  connectedCallback(): void {
    void this.loadAndRender();
  }

  attributeChangedCallback(
    name: string,
    oldVal: string | null,
    newVal: string | null,
  ): void {
    if (oldVal === newVal) return;
    if (!this.isConnected) return;
    if (name === 'form-id' || name === 'lang' || name === 'api-base') {
      void this.loadAndRender();
    }
  }

  private getApiBase(): string {
    const explicit = this.getAttribute('api-base');
    if (explicit) return explicit;
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="embed.js"]');
    const last = scripts[scripts.length - 1];
    if (last) {
      try {
        return new URL(last.src).origin;
      } catch {
        /* fall through */
      }
    }
    return '';
  }

  private getLang(): string {
    return (
      this.getAttribute('lang') ??
      document.documentElement.lang ??
      'en'
    );
  }

  private getFormId(): string | null {
    return this.getAttribute('form-id');
  }

  private async loadAndRender(): Promise<void> {
    const formId = this.getFormId();
    if (!formId) {
      this.renderError('Missing form-id attribute');
      return;
    }
    const apiBase = this.getApiBase();
    if (!apiBase) {
      this.renderError('Cannot determine API base URL');
      return;
    }
    const lang = this.getLang();

    try {
      this.schema = await fetchSchema(apiBase, formId, lang);
    } catch {
      this.renderError('Form unavailable');
      return;
    }
    this.mount(lang);
  }

  private mount(lang: string): void {
    if (!this.schema) return;
    this.innerHTML = '';

    const prefill = this.parsePrefill();
    this.rendered = renderForm(this.schema, lang, prefill);
    this.appendChild(this.rendered.container);
    this.renderedAt = Date.now();
    this.startFired = false;

    this.attachListeners();

    dispatchFormEvent(this, 'view', { formId: this.schema.formId });
  }

  private parsePrefill(): Record<string, unknown> {
    const raw = this.getAttribute('prefill');
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private attachListeners(): void {
    if (!this.rendered || !this.schema) return;
    const form = this.rendered.container;
    const formId = this.schema.formId;

    form.addEventListener('focusin', () => {
      if (!this.startFired) {
        this.startFired = true;
        dispatchFormEvent(this, 'start', { formId });
      }
    });

    form.addEventListener('change', (e) => {
      const t = e.target as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement;
      if (!t || !t.name) return;
      // Checkbox: "completed" = checked. Otherwise: "completed" = non-empty value.
      // (Without this branch, unchecking a box also fires field_complete because
      // an unchecked checkbox still has .value === 'on' — semantically wrong.)
      const completed = t.type === 'checkbox'
        ? (t as HTMLInputElement).checked
        : !!t.value;
      if (completed) {
        dispatchFormEvent(this, 'field_complete', { formId, fieldName: t.name });
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    if (!this.rendered || !this.schema) return;
    const formId = this.schema.formId;
    const apiBase = this.getApiBase();

    this.clearFieldErrors();
    const submitBtn =
      this.rendered.container.querySelector<HTMLButtonElement>('.mf-submit');
    if (submitBtn) submitBtn.disabled = true;

    const journey = readJourney(window.sessionStorage);
    const payload = {
      fields: this.rendered.getValues(),
      context: {
        page_url: window.location.href,
        page_title: document.title,
        lang: this.getLang(),
        referrer: document.referrer,
        utm: this.parseUtmFromUrl(),
        ...(journey ? { journey } : {}),
      },
      _meta: {
        honeypot: this.rendered.getHoneypotValue(),
        time_on_form_ms: Date.now() - this.renderedAt,
      },
    };

    const result = await postSubmission(apiBase, formId, payload);

    if (result.ok && result.body.id) {
      const submissionId = String(result.body.id);
      const score =
        typeof result.body.score === 'number' ? result.body.score : undefined;
      dispatchFormEvent(this, 'submit_success', { formId, submissionId, score });
      if (score !== undefined) {
        dispatchFormEvent(this, 'scored', { formId, submissionId, score });
        if (score >= 70) {
          dispatchFormEvent(this, 'qualified', { formId, submissionId, score });
        }
      }
      this.renderSuccess();
    } else {
      const errs = Array.isArray(result.body.errors)
        ? (result.body.errors as Array<{ field: string; message: string }>)
        : [];
      dispatchFormEvent(this, 'submit_attempt', { formId, errors: errs });
      this.showFieldErrors(errs);
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  private parseUtmFromUrl(): Record<string, string> {
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
      const v = params.get(`utm_${k}`);
      if (v) out[k] = v;
    }
    return out;
  }

  private clearFieldErrors(): void {
    if (!this.rendered) return;
    for (const f of this.rendered.container.querySelectorAll<HTMLElement>(
      '.mf-field',
    )) {
      f.removeAttribute('data-invalid');
      f.querySelector('.mf-error-message')?.remove();
    }
  }

  private showFieldErrors(
    errors: Array<{ field: string; message: string }>,
  ): void {
    if (!this.rendered) return;
    for (const err of errors) {
      const field = this.rendered.container.querySelector<HTMLElement>(
        `.mf-field[data-field-name="${err.field}"]`,
      );
      if (!field) continue;
      field.dataset.invalid = 'true';
      const msg = document.createElement('div');
      msg.className = 'mf-error-message';
      msg.textContent = err.message;
      field.appendChild(msg);
    }
  }

  private renderError(message: string): void {
    this.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'mf-error-message';
    div.textContent = message;
    div.setAttribute('role', 'alert');
    this.appendChild(div);
  }

  private renderSuccess(): void {
    this.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'mf-success-message';
    // Use schema.successMessage if defined (backend already localized it via ?lang=).
    // Fall back to generic English. Don't ship a hardcoded English string to CJK users.
    const msg = this.schema?.successMessage;
    div.textContent = (typeof msg === 'string' && msg)
      ? msg
      : 'Thanks — we got your message.';
    div.setAttribute('role', 'status');
    this.appendChild(div);
  }
}

export function registerFormElement(): void {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, MmldigiForm);
  }
}
