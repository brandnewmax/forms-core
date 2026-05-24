import type { FormSchema, FieldSchema } from '@mmldigi/forms-core';

const HONEYPOT_NAME = '_mf_hp';

/**
 * Resolve a string-or-i18n-map to the right language, with fallback to the
 * first available key (so a missing translation degrades gracefully instead
 * of showing undefined).
 */
function localize(
  value: string | Record<string, string> | undefined,
  lang: string,
): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (lang in value) return value[lang]!;
  const fallbackKey = Object.keys(value)[0];
  return fallbackKey ? value[fallbackKey]! : '';
}

function renderField(
  field: FieldSchema,
  lang: string,
  prefilled: unknown,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mf-field';
  wrapper.dataset.fieldName = field.name;

  const inputId = `mf-${field.name}`;
  const label = document.createElement('label');
  label.className = 'mf-label';
  label.htmlFor = inputId;
  label.textContent = localize(field.label, lang);
  if (field.required) {
    const mark = document.createElement('span');
    mark.className = 'mf-required-mark';
    mark.textContent = '*';
    mark.setAttribute('aria-hidden', 'true');
    label.appendChild(mark);
  }

  // Use precise union (not HTMLElement) — @cloudflare/workers-types ships a
  // partial HTMLElement override that conflicts with DOM's specific subclasses.
  let inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const placeholder = localize(field.placeholder, lang);

  switch (field.type) {
    case 'textarea': {
      const ta = document.createElement('textarea');
      ta.name = field.name;
      ta.id = inputId;
      ta.className = 'mf-textarea';
      if (placeholder) ta.placeholder = placeholder;
      if (field.required) { ta.required = true; ta.setAttribute('aria-required', 'true'); }
      if (typeof prefilled === 'string') ta.value = prefilled;
      inputEl = ta;
      break;
    }
    case 'select': {
      const sel = document.createElement('select');
      sel.name = field.name;
      sel.id = inputId;
      sel.className = 'mf-select';
      if (field.required) { sel.required = true; sel.setAttribute('aria-required', 'true'); }
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = placeholder || '—';
      sel.appendChild(empty);
      for (const opt of field.options ?? []) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = localize(opt.label, lang);
        sel.appendChild(o);
      }
      if (typeof prefilled === 'string') sel.value = prefilled;
      inputEl = sel;
      break;
    }
    case 'checkbox': {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = field.name;
      cb.id = inputId;
      cb.className = 'mf-checkbox';
      if (field.required) { cb.required = true; cb.setAttribute('aria-required', 'true'); }
      if (prefilled === true) cb.checked = true;

      const row = document.createElement('div');
      row.className = 'mf-checkbox-row';
      label.htmlFor = inputId;
      row.appendChild(cb);
      row.appendChild(label);
      wrapper.appendChild(row);
      return wrapper;
    }
    case 'text':
    case 'email':
    default: {
      const inp = document.createElement('input');
      inp.type = field.type === 'email' ? 'email' : 'text';
      inp.name = field.name;
      inp.id = inputId;
      inp.className = 'mf-input';
      if (placeholder) inp.placeholder = placeholder;
      if (field.required) { inp.required = true; inp.setAttribute('aria-required', 'true'); }
      if (typeof prefilled === 'string') inp.value = prefilled;
      inputEl = inp;
    }
  }

  wrapper.appendChild(label);
  wrapper.appendChild(inputEl);
  return wrapper;
}

function renderHoneypot(): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mf-honeypot';
  wrapper.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'text';
  input.name = HONEYPOT_NAME;
  input.tabIndex = -1;
  input.autocomplete = 'off';
  wrapper.appendChild(input);
  return wrapper;
}

export interface RenderedForm {
  container: HTMLFormElement;
  getValues: () => Record<string, unknown>;
  getHoneypotValue: () => string;
}

export function renderForm(
  schema: FormSchema,
  lang: string,
  prefill: Record<string, unknown> = {},
): RenderedForm {
  const form = document.createElement('form');
  form.className = 'mf-form';
  form.noValidate = true;
  form.dataset.formId = schema.formId;

  for (const field of schema.fields) {
    form.appendChild(renderField(field, lang, prefill[field.name]));
  }

  form.appendChild(renderHoneypot());

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'mf-submit';
  submit.textContent = localize(schema.submitButton, lang);
  form.appendChild(submit);

  const getValues = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const el = form.elements.namedItem(field.name);
      if (!el) continue;
      if (field.type === 'checkbox') {
        out[field.name] = (el as HTMLInputElement).checked;
      } else {
        out[field.name] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
      }
    }
    return out;
  };

  const getHoneypotValue = (): string => {
    const hp = form.elements.namedItem(HONEYPOT_NAME) as HTMLInputElement | null;
    return hp?.value ?? '';
  };

  return { container: form, getValues, getHoneypotValue };
}
