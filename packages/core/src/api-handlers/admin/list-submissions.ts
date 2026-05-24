import type { Env, Submission } from '../../types.js';
import { listSubmissions } from '../../db/queries.js';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function submissionsToCsv(items: Submission[]): string {
  const headers = [
    'id', 'form_id', 'lang', 'created_at', 'ip', 'ip_country',
    'page_url', 'utm_source', 'utm_medium', 'utm_campaign',
    'fields_json',
  ];
  const rows = items.map(s => [
    s.id, s.formId, s.lang, new Date(s.createdAt).toISOString(),
    s.context.ip, s.context.ipCountry ?? '',
    s.context.pageUrl, s.context.utm.source ?? '',
    s.context.utm.medium ?? '', s.context.utm.campaign ?? '',
    JSON.stringify(s.fields),
  ].map(csvEscape).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function handleListSubmissions(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const formId = url.searchParams.get('form_id') ?? undefined;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const format = url.searchParams.get('format');

  const opts = {
    formId,
    from: from ? parseInt(from, 10) : undefined,
    to: to ? parseInt(to, 10) : undefined,
    limit: format === 'csv' ? 10_000 : Math.min(limit, 200),
    offset,
  };
  const { items, total } = await listSubmissions(env.DB, opts);

  if (format === 'csv') {
    const csv = submissionsToCsv(items);
    const filename = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(JSON.stringify({ items, total, limit: opts.limit, offset }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
