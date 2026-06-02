/**
 * Codex MCP 配置的导入、归一化与导出模型。
 *
 * shared 层只做结构收敛和兼容字段保留，不负责启动 MCP 进程，也不验证网络可达性。
 */
export type CodexMcpTransport = "stdio" | "http" | "sse";

/**
 * 单个 MCP server 的可持久化规格。
 *
 * 末尾索引签名用于保留 Codex 或第三方 MCP 配置里的扩展字段，避免导入导出时丢配置。
 */
export type CodexMcpServerSpec = {
  type?: CodexMcpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
};

/** UI 和持久化层使用的完整 MCP server 条目，enabled 不进入原生 server spec。 */
export type CodexMcpServerConfig = {
  id: string;
  enabled: boolean;
  server: CodexMcpServerSpec;
};

/** 批量导入时同时返回有效配置和可展示给用户的错误列表。 */
export type CodexMcpImportResult = {
  servers: CodexMcpServerConfig[];
  errors: string[];
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function normalizeStringRecord(
  value: unknown,
): Record<string, string> | undefined {
  const record = toRecord(value);
  if (!record) return undefined;
  const out: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(record)) {
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) continue;
    out[normalizedKey] = String(rawValue ?? "");
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * 生成稳定、可作为配置键使用的 MCP id。
 *
 * 仅保留 Codex 配置中安全的 ASCII 字符，避免导入外部 JSON 时把空格或本地化名称写进键名。
 */
export function normalizeCodexMcpServerId(value: unknown): string {
  return normalizeText(value)
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeCodexMcpTransport(value: unknown): CodexMcpTransport {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "http" || raw === "sse") return raw;
  return "stdio";
}

/**
 * 将外部 MCP JSON 收敛成内部 spec。
 *
 * 当配置只有 url 且没有 command 时默认按 HTTP MCP 处理；未知字段原样保留以兼容新版 Codex 配置。
 */
export function normalizeCodexMcpServerSpec(
  value: unknown,
): CodexMcpServerSpec {
  const record = toRecord(value) ?? {};
  const inferredType =
    normalizeText(record.url) && !normalizeText(record.command)
      ? "http"
      : "stdio";
  const type =
    record.type == null || record.type === ""
      ? inferredType
      : normalizeCodexMcpTransport(record.type);
  const spec: CodexMcpServerSpec = { type };
  if (type === "stdio") {
    spec.command = normalizeText(record.command);
    const args = normalizeStringArray(record.args);
    if (args.length > 0) spec.args = args;
    const env = normalizeStringRecord(record.env);
    if (env) spec.env = env;
    const cwd = normalizeText(record.cwd);
    if (cwd) spec.cwd = cwd;
  } else {
    spec.url = normalizeText(record.url);
    const headers = normalizeStringRecord(
      record.headers ?? record.http_headers,
    );
    if (headers) spec.headers = headers;
  }

  for (const [key, rawValue] of Object.entries(record)) {
    if (
      key === "type" ||
      key === "command" ||
      key === "args" ||
      key === "env" ||
      key === "cwd" ||
      key === "url" ||
      key === "headers" ||
      key === "http_headers" ||
      key === "enabled"
    ) {
      continue;
    }
    if (rawValue == null) continue;
    spec[key] = rawValue;
  }
  return spec;
}

export function validateCodexMcpServerConfig(
  config: CodexMcpServerConfig,
): string | null {
  const id = normalizeCodexMcpServerId(config.id);
  if (!id) return "MCP id is required";
  const type = normalizeCodexMcpTransport(config.server?.type);
  if (type === "stdio" && !normalizeText(config.server?.command))
    return "stdio MCP is missing command";
  if ((type === "http" || type === "sse") && !normalizeText(config.server?.url))
    return `${type} MCP is missing url`;
  return null;
}

/** 将内部 MCP 条目还原成 Codex config 可写入的值，headers 会按 Codex 字段名输出为 http_headers。 */
export function codexMcpServerSpecToConfigValue(
  config: CodexMcpServerConfig,
): Record<string, unknown> {
  const spec = normalizeCodexMcpServerSpec(config.server);
  const type = normalizeCodexMcpTransport(spec.type);
  const out: Record<string, unknown> = {
    type,
    enabled: Boolean(config.enabled),
  };
  if (type === "stdio") {
    out.command = normalizeText(spec.command);
    if (Array.isArray(spec.args) && spec.args.length > 0) out.args = spec.args;
    if (spec.env && Object.keys(spec.env).length > 0) out.env = spec.env;
    if (spec.cwd) out.cwd = spec.cwd;
  } else {
    out.url = normalizeText(spec.url);
    if (spec.headers && Object.keys(spec.headers).length > 0)
      out.http_headers = spec.headers;
  }
  for (const [key, value] of Object.entries(spec)) {
    if (key in out || key === "headers") continue;
    if (value == null) continue;
    out[key] = value;
  }
  return out;
}

export function configValueToCodexMcpServerConfig(
  idValue: unknown,
  value: unknown,
): CodexMcpServerConfig | null {
  const id = normalizeCodexMcpServerId(idValue);
  const record = toRecord(value);
  if (!id || !record) return null;
  const server = normalizeCodexMcpServerSpec(record);
  return {
    id,
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    server,
  };
}

/**
 * 解析用户粘贴的 MCP JSON。
 *
 * 同时兼容标准的 { mcpServers } 批量格式和单个 server 对象格式，便于从不同客户端迁移配置。
 */
export function parseCodexMcpJsonImport(text: string): CodexMcpImportResult {
  const errors: string[] = [];
  const servers: CodexMcpServerConfig[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(text ?? "").trim());
  } catch (error: any) {
    return {
      servers: [],
      errors: [`Failed to parse JSON: ${String(error?.message ?? error)}`],
    };
  }
  const root = toRecord(parsed);
  if (!root)
    return { servers: [], errors: ["JSON top level must be an object"] };
  const mcpServers = toRecord(root.mcpServers);
  if (mcpServers) {
    for (const [rawId, rawSpec] of Object.entries(mcpServers)) {
      const rawRecord = toRecord(rawSpec);
      const config: CodexMcpServerConfig = {
        id: normalizeCodexMcpServerId(rawId),
        enabled:
          typeof rawRecord?.enabled === "boolean" ? rawRecord.enabled : true,
        server: normalizeCodexMcpServerSpec(rawSpec),
      };
      const error = validateCodexMcpServerConfig(config);
      if (error) errors.push(`${rawId}: ${error}`);
      else servers.push(config);
    }
    return { servers, errors };
  }

  const id = normalizeCodexMcpServerId(root.id ?? root.name);
  const specSource = toRecord(root.server) ?? root;
  const config: CodexMcpServerConfig = {
    id,
    enabled: typeof root.enabled === "boolean" ? root.enabled : true,
    server: normalizeCodexMcpServerSpec(specSource),
  };
  const error = validateCodexMcpServerConfig(config);
  if (error) errors.push(error);
  else servers.push(config);
  return { servers, errors };
}
