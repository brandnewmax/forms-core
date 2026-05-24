import { describe, it, expect } from 'vitest';
import { validateFields } from '../src/validation.js';
import type { FormSchema } from '../src/index.js';

const schema: FormSchema = {
  formId: 'contact',
  version: 1,
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Name', validation: { maxLength: 100 } },
    { name: 'email', type: 'email', required: true, label: 'Email' },
    { name: 'company', type: 'text', label: 'Company', validation: { minLength: 2, maxLength: 200 } },
    { name: 'message', type: 'textarea', label: 'Message', validation: { maxLength: 5000 } },
    {
      name: 'service',
      type: 'select',
      label: 'Service',
      options: [{ value: 'seo', label: 'SEO' }, { value: 'geo', label: 'GEO' }],
    },
    { name: 'consent', type: 'checkbox', required: true, label: 'Consent' },
  ],
  submitButton: 'Send',
};

describe('validateFields', () => {
  it('returns empty errors for valid input', () => {
    const errors = validateFields(schema, {
      name: 'John',
      email: 'john@test.com',
      company: 'Acme',
      message: 'hi',
      service: 'seo',
      consent: true,
    });
    expect(errors).toEqual([]);
  });

  it('flags missing required fields', () => {
    const errors = validateFields(schema, { email: 'a@b.com', consent: true });
    expect(errors).toContainEqual({ field: 'name', message: 'Required' });
  });

  it('flags invalid email format', () => {
    const errors = validateFields(schema, {
      name: 'J', email: 'not-an-email', consent: true,
    });
    expect(errors).toContainEqual({ field: 'email', message: 'Invalid email format' });
  });

  it('flags maxLength violation', () => {
    const long = 'x'.repeat(101);
    const errors = validateFields(schema, {
      name: long, email: 'a@b.com', consent: true,
    });
    expect(errors).toContainEqual({ field: 'name', message: 'Maximum 100 characters' });
  });

  it('flags minLength violation', () => {
    const errors = validateFields(schema, {
      name: 'J', email: 'a@b.com', company: 'a', consent: true,
    });
    expect(errors).toContainEqual({ field: 'company', message: 'Minimum 2 characters' });
  });

  it('flags select value not in options', () => {
    const errors = validateFields(schema, {
      name: 'J', email: 'a@b.com', service: 'invalid', consent: true,
    });
    expect(errors).toContainEqual({ field: 'service', message: 'Invalid option' });
  });

  it('flags required checkbox not checked', () => {
    const errors = validateFields(schema, {
      name: 'J', email: 'a@b.com', consent: false,
    });
    expect(errors).toContainEqual({ field: 'consent', message: 'Required' });
  });

  it('rejects non-string text values', () => {
    const errors = validateFields(schema, {
      name: 123, email: 'a@b.com', consent: true,
    } as any);
    expect(errors).toContainEqual({ field: 'name', message: 'Must be a string' });
  });

  it('ignores fields not in schema (no error, but value not validated)', () => {
    const errors = validateFields(schema, {
      name: 'J', email: 'a@b.com', consent: true, unknownField: 'foo',
    });
    expect(errors).toEqual([]);
  });
});
