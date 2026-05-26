import type { FormSchema } from '@mmldigi/forms-core';
import type { JourneyEntry } from './journey.js';

export interface SubmissionPayload {
  fields: Record<string, unknown>;
  context: {
    page_url: string;
    page_title?: string;
    lang?: string;
    referrer?: string;
    utm: Record<string, string>;
    session_id?: string;
    first_seen_at?: number;
    viewport?: string;
    ua_brand?: string;
    journey?: JourneyEntry[];
  };
  _meta: {
    honeypot: string;
    time_on_form_ms: number;
  };
}

export interface SubmissionResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export async function fetchSchema(
  apiBase: string,
  formId: string,
  lang: string,
): Promise<FormSchema> {
  const url = `${apiBase}/api/v1/forms/${encodeURIComponent(formId)}/schema?lang=${encodeURIComponent(lang)}`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`fetchSchema failed: HTTP ${resp.status}`);
  }
  return await resp.json() as FormSchema;
}

export async function postSubmission(
  apiBase: string,
  formId: string,
  payload: SubmissionPayload,
): Promise<SubmissionResult> {
  const url = `${apiBase}/api/v1/forms/${encodeURIComponent(formId)}/submissions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body: Record<string, unknown>;
  try {
    body = await resp.json() as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { ok: resp.ok, status: resp.status, body };
}
