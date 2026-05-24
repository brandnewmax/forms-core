/**
 * 表单字段 schema 单元(SurveyJS 兼容的子集,Phase 1a 只支持 5 种)
 */
export interface FieldSchema {
  name: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  label: string | Record<string, string>;     // 字符串或 i18n map
  placeholder?: string | Record<string, string>;
  options?: Array<{ value: string; label: string | Record<string, string> }>;  // select 用
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;     // 正则
  };
}

/**
 * 完整表单 schema
 */
export interface FormSchema {
  formId: string;
  version: number;
  fields: FieldSchema[];
  submitButton: string | Record<string, string>;
  successMessage?: string | Record<string, string>;
  // Note: spam_min_time_ms lives in forms_settings (FormSettings.spamMinTimeMs),
  // NOT here. Keeps a single source of truth and avoids leaking the value to the
  // client via GET /schema.
}

/**
 * 校验错误
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 提交流水线上下文 —— 插件可读写
 */
export interface SubmitCtx {
  formId: string;
  lang: string;
  fields: Record<string, unknown>;
  enriched: Record<string, unknown>;
  context: {
    ip: string;
    ipCountry?: string;
    userAgent: string;
    referrer: string;
    pageUrl: string;
    utm: Record<string, string>;
    journey?: Array<{ url: string; ts: number }>;
    sessionId?: string;
    firstSeenAt?: number;
  };
}

/**
 * 已落库的 submission
 */
export interface Submission extends SubmitCtx {
  id: string;
  schemaVersion: number;
  createdAt: number;
  score?: number;
  scoreDetails?: Record<string, unknown>;
  feishuSyncStatus?: 'sent' | 'failed';      // undefined = not attempted (DB NULL)
  emailForwardStatus?: 'sent' | 'failed';     // undefined = not attempted (DB NULL)
}

/**
 * 提交响应
 */
export interface SubmitResponse {
  id: string;
  score?: number;
  redirectUrl?: string;
  customMessage?: string;
}

/**
 * CF Pages Functions Env(初版 binding)
 */
export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  ALLOWED_ORIGINS: string;        // 逗号分隔
  ENVIRONMENT: 'development' | 'staging' | 'production';
  // ── Phase 1c admin auth ──
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ADMIN_GITHUB_USERS?: string;    // comma-separated GitHub logins
  SESSION_SECRET?: string;         // HMAC signing key for session cookies
  ADMIN_BASE_URL?: string;         // e.g. https://forms.mmldigi.com (for OAuth callback URL)
}

/**
 * Reject 信号(从 hook 返回)
 */
export interface RejectSignal {
  reject: string;
  status?: number;
}
