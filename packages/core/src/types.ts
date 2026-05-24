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
  spamMinTimeMs?: number;     // 默认 3000
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
  feishuSyncStatus?: 'pending' | 'sent' | 'failed';
  emailForwardStatus?: 'pending' | 'sent' | 'failed';
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
}

/**
 * Reject 信号(从 hook 返回)
 */
export interface RejectSignal {
  reject: string;
  status?: number;
}
