import type { Submission } from './types.js';

export interface EmailOptions {
  toEmails: string[];
  fromEmail: string;
  fromName: string;
  subject: string;
  apiKey: string;          // Resend API key
}

export interface EmailResult {
  ok: boolean;
  status?: number;
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function buildEmailHtml(s: Submission): string {
  const rows = Object.entries(s.fields).map(([k, v]) =>
    `<tr><td style="padding:6px 12px;color:#666;font-family:monospace;">${escapeHtml(k)}</td><td style="padding:6px 12px;">${escapeHtml(v)}</td></tr>`
  ).join('');
  const journey = s.context.journey;
  const journeyHtml = journey && journey.length > 0
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#666;">Browsing path (${journey.length})</h3>
  <ol style="font-size:13px;color:#333;padding-left:20px;margin:0 0 8px;">
    ${journey.map(j =>
      `<li style="padding:2px 0;">${escapeHtml(j.url)}${j.title ? ` — <span style="color:#888;">${escapeHtml(j.title)}</span>` : ''} <span style="color:#aaa;">${escapeHtml(new Date(j.ts).toISOString())}</span></li>`
    ).join('')}
  </ol>`
    : '';
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;color:#1A1A1A;">
  <h2 style="margin:0 0 16px;">New inquiry — ${escapeHtml(s.formId)}</h2>
  <p style="color:#666;font-size:13px;margin:0 0 24px;">
    Submitted ${new Date(s.createdAt).toISOString()} · IP ${escapeHtml(s.context.ip)} (${escapeHtml(s.context.ipCountry ?? 'unknown')})
  </p>
  <table style="border-collapse:collapse;width:100%;background:#F7F7F8;border-radius:6px;overflow:hidden;">
    ${rows}
  </table>
  <h3 style="margin:24px 0 8px;font-size:14px;color:#666;">Context</h3>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <tr><td style="padding:4px 12px;color:#888;">Page</td><td style="padding:4px 12px;"><a href="${escapeHtml(s.context.pageUrl)}">${escapeHtml(s.context.pageUrl)}</a></td></tr>
    <tr><td style="padding:4px 12px;color:#888;">Referrer</td><td style="padding:4px 12px;">${escapeHtml(s.context.referrer || '(direct)')}</td></tr>
    <tr><td style="padding:4px 12px;color:#888;">UTM</td><td style="padding:4px 12px;">${escapeHtml(JSON.stringify(s.context.utm))}</td></tr>
    <tr><td style="padding:4px 12px;color:#888;">Submission ID</td><td style="padding:4px 12px;font-family:monospace;">${escapeHtml(s.id)}</td></tr>
  </table>
  ${journeyHtml}
</body></html>`;
}

export async function sendSubmissionEmail(
  submission: Submission,
  opts: EmailOptions,
): Promise<EmailResult> {
  const html = buildEmailHtml(submission);
  const payload = {
    from: `${opts.fromName} <${opts.fromEmail}>`,
    to: opts.toEmails,
    subject: opts.subject,
    html,
  };
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return { ok: resp.ok, status: resp.status };
}
