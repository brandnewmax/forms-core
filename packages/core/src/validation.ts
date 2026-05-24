import type { FormSchema, FieldSchema, ValidationError } from './types.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFields(
  schema: FormSchema,
  values: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of schema.fields) {
    const value = values[field.name];
    errors.push(...validateField(field, value));
  }

  return errors;
}

function validateField(field: FieldSchema, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required check first
  if (field.required) {
    if (field.type === 'checkbox') {
      if (value !== true) errors.push({ field: field.name, message: 'Required' });
    } else if (value === undefined || value === null || value === '') {
      errors.push({ field: field.name, message: 'Required' });
    }
  }

  // Skip further validation if empty + not required
  if (value === undefined || value === null || value === '') return errors;

  // Type-specific validation
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
      if (typeof value !== 'string') {
        errors.push({ field: field.name, message: 'Must be a string' });
        return errors;
      }
      if (field.type === 'email' && !EMAIL_RE.test(value)) {
        errors.push({ field: field.name, message: 'Invalid email format' });
      }
      if (field.validation?.maxLength && value.length > field.validation.maxLength) {
        errors.push({ field: field.name, message: `Maximum ${field.validation.maxLength} characters` });
      }
      if (field.validation?.minLength && value.length < field.validation.minLength) {
        errors.push({ field: field.name, message: `Minimum ${field.validation.minLength} characters` });
      }
      if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(value)) {
        errors.push({ field: field.name, message: 'Invalid format' });
      }
      break;

    case 'select':
      if (typeof value !== 'string') {
        errors.push({ field: field.name, message: 'Must be a string' });
        return errors;
      }
      if (field.options && !field.options.some(o => o.value === value)) {
        errors.push({ field: field.name, message: 'Invalid option' });
      }
      break;

    case 'checkbox':
      if (typeof value !== 'boolean') {
        errors.push({ field: field.name, message: 'Must be true or false' });
      }
      break;
  }

  return errors;
}
