import type { Submission } from './types.js';

export type WebhookTemplate = 'raw' | 'wecom_markdown' | 'dingtalk_text';

export interface WebhookConfig {
  id: string;
  url: string;
  payload_template: WebhookTemplate;
  event_filter?: string[];
  secret?: string;
}

export interface WebhookResult {
  id: string;
  ok: boolean;
  status?: number;
  error?: string;
}

function buildRaw(s: Submission): unknown {
  return s;
}

function buildWecomMarkdown(s: Submission): unknown {
  const fieldsLines = Object.entries(s.fields)
    .map(([k, v]) => `> **${k}**: ${String(v ?? '').slice(0, 200)}`)
    .join('\n');
  const content = `### 🆕 New inquiry — ${s.formId}\n\n${fieldsLines}\n\n> IP: ${s.context.ip} (${s.context.ipCountry ?? '?'})\n> Page: ${s.context.pageUrl}\n> ID: \`${s.id}\``;
  return { msgtype: 'markdown', markdown: { content } };
}

function buildDingtalkText(s: Submission): unknown {
  const fieldsLines = Object.entries(s.fields)
    .map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 200)}`)
    .join('\n');
  const content = `New inquiry — ${s.formId}\n\n${fieldsLines}\n\nIP: ${s.context.ip} (${s.context.ipCountry ?? '?'})\nPage: ${s.context.pageUrl}\nID: ${s.id}`;
  return { msgtype: 'text', text: { content } };
}

function buildPayload(s: Submission, template: WebhookTemplate): unknown {
  switch (template) {
    case 'wecom_markdown': return buildWecomMarkdown(s);
    case 'dingtalk_text':  return buildDingtalkText(s);
    case 'raw':            return buildRaw(s);
  }
}

export async function dispatchWebhook(
  submission: Submission,
  cfg: WebhookConfig,
): Promise<WebhookResult> {
  const payload = buildPayload(submission, cfg.payload_template);
  try {
    const resp = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { id: cfg.id, ok: resp.ok, status: resp.status };
  } catch (e) {
    return { id: cfg.id, ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
