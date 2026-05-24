export type FormEventType =
  | 'view'
  | 'start'
  | 'field_complete'
  | 'submit_attempt'
  | 'submit_success'
  | 'scored'
  | 'qualified';

export interface FormEventDetail {
  type: FormEventType;
  formId: string;
  submissionId?: string;
  fieldName?: string;
  errors?: Array<{ field: string; message: string }>;
  score?: number;
}

/**
 * Dispatch a lifecycle event. Bubbles up from target so host listeners on
 * window/document/parent all see it. Use one global event name with `type`
 * in detail so consumers only need a single listener.
 */
export function dispatchFormEvent(
  target: EventTarget,
  type: FormEventType,
  extras: Omit<FormEventDetail, 'type'>,
): void {
  const detail: FormEventDetail = { type, ...extras };
  const event = new CustomEvent('mmldigi-form-event', {
    detail,
    bubbles: true,
    composed: true,
  });
  target.dispatchEvent(event);
}
