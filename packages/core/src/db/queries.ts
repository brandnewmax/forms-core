import type { Submission, FormSchema } from '../types.js';

export interface ListSubmissionsOptions {
  formId?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export interface FormSettings {
  formId: string;
  notifyEmails: string[];
  webhooks: unknown[];
  feishuConfig: unknown | null;
  scoreThreshold: number;
  spamMinTimeMs: number;
  rateLimitPerIp: number;
  redirectAfterSubmit: string | null;
}

export async function insertSubmission(db: D1Database, s: Submission): Promise<void> {
  await db.prepare(`
    INSERT INTO submissions (
      id, form_id, schema_version, lang,
      fields_json, enriched_json,
      page_url, referrer,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      ip, ip_country, ip_city, user_agent, ua_brand,
      session_id, first_seen_at, journey_json,
      score, score_details_json, qualified,
      feishu_sync_status, email_forward_status,
      created_at, updated_at
    ) VALUES (
      ?1, ?2, ?3, ?4,
      ?5, ?6,
      ?7, ?8,
      ?9, ?10, ?11, ?12, ?13,
      ?14, ?15, ?16, ?17, ?18,
      ?19, ?20, ?21,
      ?22, ?23, ?24,
      ?25, ?26,
      ?27, ?28
    )
  `).bind(
    s.id, s.formId, s.schemaVersion, s.lang,
    JSON.stringify(s.fields), JSON.stringify(s.enriched),
    s.context.pageUrl, s.context.referrer,
    s.context.utm.source ?? null, s.context.utm.medium ?? null, s.context.utm.campaign ?? null,
    s.context.utm.term ?? null, s.context.utm.content ?? null,
    s.context.ip, s.context.ipCountry ?? null, null, s.context.userAgent, null,
    s.context.sessionId ?? null, s.context.firstSeenAt ?? null,
    s.context.journey ? JSON.stringify(s.context.journey) : null,
    s.score ?? null, s.scoreDetails ? JSON.stringify(s.scoreDetails) : null, 0,
    s.feishuSyncStatus ?? null, s.emailForwardStatus ?? null,
    s.createdAt, s.createdAt,
  ).run();
}

interface SubmissionRow {
  id: string;
  form_id: string;
  schema_version: number;
  lang: string;
  fields_json: string;
  enriched_json: string | null;
  page_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  ip: string | null;
  ip_country: string | null;
  ip_city: string | null;
  user_agent: string | null;
  ua_brand: string | null;
  session_id: string | null;
  first_seen_at: number | null;
  journey_json: string | null;
  score: number | null;
  score_details_json: string | null;
  qualified: number;
  feishu_sync_status: string | null;
  email_forward_status: string | null;
  created_at: number;
}

/**
 * Defensively parse JSON column. Returns `fallback` on parse failure, logging
 * the error. Used to keep a single bad row from 500'ing the whole list query.
 */
function safeJson<T>(raw: string | null, fallback: T, ctx: string): T {
  if (raw === null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[db:queries] malformed JSON in ${ctx}`, e);
    return fallback;
  }
}

function rowToSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    formId: r.form_id,
    schemaVersion: r.schema_version,
    lang: r.lang,
    fields: safeJson<Record<string, unknown>>(r.fields_json, {}, `submissions.${r.id}.fields_json`),
    enriched: safeJson<Record<string, unknown>>(r.enriched_json, {}, `submissions.${r.id}.enriched_json`),
    context: {
      ip: r.ip ?? '',
      ipCountry: r.ip_country ?? undefined,
      userAgent: r.user_agent ?? '',
      referrer: r.referrer ?? '',
      pageUrl: r.page_url ?? '',
      utm: {
        ...(r.utm_source && { source: r.utm_source }),
        ...(r.utm_medium && { medium: r.utm_medium }),
        ...(r.utm_campaign && { campaign: r.utm_campaign }),
        ...(r.utm_term && { term: r.utm_term }),
        ...(r.utm_content && { content: r.utm_content }),
      },
      sessionId: r.session_id ?? undefined,
      firstSeenAt: r.first_seen_at ?? undefined,
      journey: r.journey_json
        ? safeJson<Array<{ url: string; ts: number }> | undefined>(r.journey_json, undefined, `submissions.${r.id}.journey_json`)
        : undefined,
    },
    score: r.score ?? undefined,
    scoreDetails: r.score_details_json
      ? safeJson<Record<string, unknown> | undefined>(r.score_details_json, undefined, `submissions.${r.id}.score_details_json`)
      : undefined,
    feishuSyncStatus: (r.feishu_sync_status as Submission['feishuSyncStatus']) ?? undefined,
    emailForwardStatus: (r.email_forward_status as Submission['emailForwardStatus']) ?? undefined,
    createdAt: r.created_at,
  };
}

export async function getSubmission(db: D1Database, id: string): Promise<Submission | null> {
  const row = await db.prepare('SELECT * FROM submissions WHERE id = ?1').bind(id).first<SubmissionRow>();
  return row ? rowToSubmission(row) : null;
}

export async function listSubmissions(
  db: D1Database,
  opts: ListSubmissionsOptions,
): Promise<{ items: Submission[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.formId) { where.push(`form_id = ?${params.length + 1}`); params.push(opts.formId); }
  if (opts.from)   { where.push(`created_at >= ?${params.length + 1}`); params.push(opts.from); }
  if (opts.to)     { where.push(`created_at < ?${params.length + 1}`); params.push(opts.to); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await db.prepare(`SELECT COUNT(*) AS n FROM submissions ${whereSql}`)
    .bind(...params).first<{ n: number }>();
  const total = totalRow?.n ?? 0;

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const rows = await db.prepare(`
    SELECT * FROM submissions ${whereSql}
    ORDER BY created_at DESC
    LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}
  `).bind(...params, limit, offset).all<SubmissionRow>();

  return { items: rows.results.map(rowToSubmission), total };
}

export async function getLatestSchema(db: D1Database, formId: string): Promise<FormSchema | null> {
  const row = await db.prepare(`
    SELECT schema_json FROM schema_versions
    WHERE form_id = ?1
    ORDER BY version DESC
    LIMIT 1
  `).bind(formId).first<{ schema_json: string }>();
  if (!row) return null;
  return safeJson<FormSchema | null>(row.schema_json, null, `schema_versions.${formId}.schema_json`);
}

export async function getFormSettings(db: D1Database, formId: string): Promise<FormSettings | null> {
  const row = await db.prepare(`SELECT * FROM forms_settings WHERE form_id = ?1`).bind(formId).first<{
    form_id: string;
    notify_emails: string;
    webhooks_json: string;
    feishu_config: string | null;
    score_threshold: number;
    spam_min_time_ms: number;
    rate_limit_per_ip: number;
    redirect_after_submit: string | null;
  }>();
  if (!row) return null;
  return {
    formId: row.form_id,
    notifyEmails: safeJson<string[]>(row.notify_emails, [], `forms_settings.${formId}.notify_emails`),
    webhooks: safeJson<unknown[]>(row.webhooks_json, [], `forms_settings.${formId}.webhooks_json`),
    feishuConfig: safeJson<unknown | null>(row.feishu_config, null, `forms_settings.${formId}.feishu_config`),
    scoreThreshold: row.score_threshold,
    spamMinTimeMs: row.spam_min_time_ms,
    rateLimitPerIp: row.rate_limit_per_ip,
    redirectAfterSubmit: row.redirect_after_submit,
  };
}
