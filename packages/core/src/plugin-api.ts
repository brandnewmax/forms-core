import type {
  SubmitCtx,
  Submission,
  SubmitResponse,
  ValidationError,
  RejectSignal,
  Env,
} from './types.js';

/**
 * 单个 admin UI 列定义
 */
export interface AdminColumn {
  id: string;
  label: string;
  render: (submission: Submission) => string;
}

/**
 * 单个 admin UI 详情区块
 */
export interface AdminSection {
  id: string;
  title: string;
  render: (submission: Submission) => string;
}

/**
 * 单个 admin dashboard widget
 */
export interface AdminWidget {
  id: string;
  title: string;
  render: () => Promise<string>;
}

/**
 * 单个 admin 设置面板
 */
export interface AdminPanel {
  id: string;
  title: string;
  render: () => string;
}

/**
 * 单条 plugin 路由
 */
export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  auth?: 'admin' | 'public' | 'internal';
  handler: (req: Request, env: Env) => Response | Promise<Response>;
}

/**
 * 单个 plugin worker(CF Queue 消费者)
 */
export interface PluginWorker {
  queue: string;
  handler: (batch: MessageBatch<unknown>, env: Env) => Promise<void>;
}

/**
 * Plugin 客户端扩展(打包进 embed.js,Phase 1a 只定义类型)
 */
export interface ClientExtensions {
  extraEvents?: string[];
  contextProviders?: string[];
}

/**
 * Plugin 主接口
 *
 * 一个 plugin 实现哪些字段 = 它挂载哪些 hook / 扩展点
 */
export interface FormsPlugin {
  name: string;
  version: string;
  priority?: number;     // 默认 100,数字越小越早执行

  // ── 提交流水线 5 个 hook ──
  beforeValidate?: (ctx: SubmitCtx, env: Env) => Promise<SubmitCtx | RejectSignal> | SubmitCtx | RejectSignal;
  afterValidate?:  (ctx: SubmitCtx, errors: ValidationError[], env: Env) => Promise<void> | void;
  beforeStore?:    (ctx: SubmitCtx, env: Env) => Promise<Partial<SubmitCtx['enriched']>>;
  afterStore?:     (submission: Submission, env: Env) => Promise<void>;   // 异步,错误隔离
  beforeRespond?:  (response: SubmitResponse, submission: Submission, env: Env) => SubmitResponse | Promise<SubmitResponse>;

  // ── 扩展点 ──
  routes?: PluginRoute[];
  workers?: PluginWorker[];
  ui?: {
    listColumns?: () => AdminColumn[];
    detailSections?: () => AdminSection[];
    dashboardWidgets?: () => AdminWidget[];
    settingsPanel?: () => AdminPanel;
  };
  clientExtensions?: ClientExtensions;
}
