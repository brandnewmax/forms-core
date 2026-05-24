import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dispatchFormEvent, type FormEventType } from '../src/events.js';

describe('dispatchFormEvent', () => {
  let target: HTMLElement;
  let captured: CustomEvent[] = [];
  let handler: (e: Event) => void;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    captured = [];
    handler = (e) => { captured.push(e as CustomEvent); };
    window.addEventListener('mmldigi-form-event', handler);
  });

  afterEach(() => {
    window.removeEventListener('mmldigi-form-event', handler);
    target.remove();
  });

  it('dispatches a window-level CustomEvent with name mmldigi-form-event', () => {
    dispatchFormEvent(target, 'view', { formId: 'contact' });
    expect(captured).toHaveLength(1);
    expect(captured[0]!.type).toBe('mmldigi-form-event');
  });

  it('detail includes type, formId, and extra fields', () => {
    dispatchFormEvent(target, 'submit_success', {
      formId: 'contact',
      submissionId: 'sub-1',
    });
    expect(captured[0]!.detail).toEqual({
      type: 'submit_success',
      formId: 'contact',
      submissionId: 'sub-1',
    });
  });

  it('supports all 7 lifecycle event types', () => {
    const types: FormEventType[] = [
      'view', 'start', 'field_complete',
      'submit_attempt', 'submit_success', 'scored', 'qualified',
    ];
    for (const t of types) {
      dispatchFormEvent(target, t, { formId: 'contact' });
    }
    expect(captured).toHaveLength(7);
    expect(captured.map(e => e.detail.type)).toEqual(types);
  });

  it('events bubble up from the target', () => {
    const parentCaptured: Event[] = [];
    document.body.addEventListener('mmldigi-form-event', (e) => parentCaptured.push(e));
    dispatchFormEvent(target, 'view', { formId: 'contact' });
    expect(parentCaptured).toHaveLength(1);
  });
});
