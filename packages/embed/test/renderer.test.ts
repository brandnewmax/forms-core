import { describe, it, expect, beforeEach } from 'vitest';
import { renderForm } from '../src/renderer.js';
import type { FormSchema } from '@mmldigi/forms-core';

const schema: FormSchema = {
  formId: 'contact',
  version: 1,
  submitButton: 'Send',
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Name' },
    { name: 'email', type: 'email', required: true, label: 'Email', placeholder: 'you@company.com' },
    { name: 'company', type: 'text', label: 'Company' },
    { name: 'message', type: 'textarea', required: true, label: 'Message' },
    {
      name: 'service', type: 'select', label: 'Service',
      options: [
        { value: 'seo', label: 'SEO' },
        { value: 'geo', label: 'GEO' },
      ],
    },
    { name: 'consent', type: 'checkbox', required: true, label: 'I agree to be contacted' },
  ],
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('renderForm', () => {
  it('renders a <form class="mf-form"> root', () => {
    const { container } = renderForm(schema, 'en');
    expect(container.tagName).toBe('FORM');
    expect(container.classList.contains('mf-form')).toBe(true);
  });

  it('renders one .mf-field per schema field + a honeypot + a submit button', () => {
    const { container } = renderForm(schema, 'en');
    const fields = container.querySelectorAll('.mf-field');
    expect(fields).toHaveLength(6);
    expect(container.querySelector('.mf-honeypot')).not.toBeNull();
    expect(container.querySelector('.mf-submit')).not.toBeNull();
  });

  it('text input has correct attrs', () => {
    const { container } = renderForm(schema, 'en');
    const input = container.querySelector('input[name="name"]') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('email input uses type="email" and applies placeholder', () => {
    const { container } = renderForm(schema, 'en');
    const input = container.querySelector('input[name="email"]') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('you@company.com');
  });

  it('textarea field renders <textarea>', () => {
    const { container } = renderForm(schema, 'en');
    expect(container.querySelector('textarea[name="message"]')).not.toBeNull();
  });

  it('select renders <select> with one <option> per schema option', () => {
    const { container } = renderForm(schema, 'en');
    const select = container.querySelector('select[name="service"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[1]!.value).toBe('seo');
    expect(options[2]!.value).toBe('geo');
  });

  it('checkbox renders inside .mf-checkbox-row', () => {
    const { container } = renderForm(schema, 'en');
    const cb = container.querySelector('input[name="consent"]') as HTMLInputElement;
    expect(cb.type).toBe('checkbox');
    expect(cb.required).toBe(true);
    expect(cb.closest('.mf-checkbox-row')).not.toBeNull();
  });

  it('required fields get a "*" mark in label', () => {
    const { container } = renderForm(schema, 'en');
    const nameLabel = container.querySelector('label[for]')!;
    expect(nameLabel.querySelector('.mf-required-mark')?.textContent).toBe('*');
  });

  it('i18n: resolves label from object using lang param', () => {
    const i18nSchema: FormSchema = {
      ...schema,
      fields: [{ name: 'q', type: 'text', label: { en: 'Question', es: 'Pregunta' } }],
      submitButton: { en: 'Send', es: 'Enviar' },
    };
    const { container } = renderForm(i18nSchema, 'es');
    expect(container.querySelector('label')?.textContent?.trim()).toBe('Pregunta');
    expect(container.querySelector('.mf-submit')?.textContent).toBe('Enviar');
  });

  it('i18n: falls back to first key when lang missing', () => {
    const i18nSchema: FormSchema = {
      ...schema,
      fields: [{ name: 'q', type: 'text', label: { en: 'Question' } }],
      submitButton: { en: 'Send' },
    };
    const { container } = renderForm(i18nSchema, 'fr');
    expect(container.querySelector('label')?.textContent?.trim()).toBe('Question');
  });

  it('getValues returns current field values', () => {
    const { container, getValues } = renderForm(schema, 'en');
    (container.querySelector('input[name="name"]') as HTMLInputElement).value = 'Alice';
    (container.querySelector('input[name="email"]') as HTMLInputElement).value = 'a@b.com';
    (container.querySelector('input[name="consent"]') as HTMLInputElement).checked = true;
    const values = getValues();
    expect(values.name).toBe('Alice');
    expect(values.email).toBe('a@b.com');
    expect(values.consent).toBe(true);
  });

  it('getValues excludes the honeypot field', () => {
    const { getValues } = renderForm(schema, 'en');
    const values = getValues();
    expect(values._hp).toBeUndefined();
    expect(Object.keys(values)).toEqual(
      expect.arrayContaining(['name', 'email', 'company', 'message', 'service', 'consent']),
    );
  });

  it('prefill values are applied at render time', () => {
    const { container } = renderForm(schema, 'en', { name: 'Bob', email: 'b@b.com' });
    expect((container.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Bob');
    expect((container.querySelector('input[name="email"]') as HTMLInputElement).value).toBe('b@b.com');
  });
});
