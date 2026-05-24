-- 0001_initial.sql: forms + schema_versions + submissions tables
-- Phase 1a: core data model for inquiry capture

CREATE TABLE IF NOT EXISTS forms (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id      TEXT NOT NULL,
  version      INTEGER NOT NULL,
  schema_json  TEXT NOT NULL,
  created_by   TEXT,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (form_id) REFERENCES forms(id),
  UNIQUE(form_id, version)
);
CREATE INDEX IF NOT EXISTS idx_schema_form ON schema_versions(form_id, version DESC);

CREATE TABLE IF NOT EXISTS submissions (
  id                    TEXT PRIMARY KEY,
  form_id               TEXT NOT NULL,
  schema_version        INTEGER NOT NULL,
  lang                  TEXT NOT NULL,
  fields_json           TEXT NOT NULL,
  enriched_json         TEXT,
  -- visitor context
  page_url              TEXT,
  referrer              TEXT,
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_term              TEXT,
  utm_content           TEXT,
  ip                    TEXT,
  ip_country            TEXT,
  ip_city               TEXT,
  user_agent            TEXT,
  ua_brand              TEXT,
  session_id            TEXT,
  first_seen_at         INTEGER,
  journey_json          TEXT,
  -- Pro fields (Lite leaves empty)
  score                 INTEGER,
  score_details_json    TEXT,
  qualified             INTEGER NOT NULL DEFAULT 0,
  -- sync status
  feishu_sync_status    TEXT,
  feishu_record_id      TEXT,
  email_forward_status  TEXT,
  webhook_dispatch_log  TEXT,
  plugin_errors_json    TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  FOREIGN KEY (form_id) REFERENCES forms(id)
);
CREATE INDEX IF NOT EXISTS idx_sub_form_created ON submissions(form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_country      ON submissions(ip_country);

-- forms_settings: per-form notifications / webhooks / thresholds
CREATE TABLE IF NOT EXISTS forms_settings (
  form_id              TEXT PRIMARY KEY,
  notify_emails        TEXT NOT NULL DEFAULT '[]',
  webhooks_json        TEXT NOT NULL DEFAULT '[]',
  feishu_config        TEXT,
  score_threshold      INTEGER NOT NULL DEFAULT 70,
  spam_min_time_ms     INTEGER NOT NULL DEFAULT 3000,
  rate_limit_per_ip    INTEGER NOT NULL DEFAULT 5,
  redirect_after_submit TEXT,
  FOREIGN KEY (form_id) REFERENCES forms(id)
);

-- Seed: 'contact' form for local dev
-- Note: schema_json does NOT include spamMinTimeMs — that lives in forms_settings (single source of truth)
INSERT OR IGNORE INTO forms (id, name, active, created_at, updated_at)
VALUES ('contact', 'Contact Form', 1, unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO schema_versions (form_id, version, schema_json, created_at)
VALUES (
  'contact',
  1,
  '{"formId":"contact","version":1,"fields":[{"name":"name","type":"text","required":true,"label":"Name","validation":{"maxLength":100}},{"name":"email","type":"email","required":true,"label":"Email"},{"name":"company","type":"text","label":"Company","validation":{"maxLength":200}},{"name":"message","type":"textarea","required":true,"label":"Message","validation":{"maxLength":5000}}],"submitButton":"Send"}',
  unixepoch() * 1000
);

INSERT OR IGNORE INTO forms_settings (form_id, notify_emails)
VALUES ('contact', '["dev@example.com"]');
