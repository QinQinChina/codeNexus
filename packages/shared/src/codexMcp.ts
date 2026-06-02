export type CodexMcpTransport = "stdio" | "http" | "sse";

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

export type CodexMcpServerConfig = {
  id: string;
  enabled: boolean;
  server: CodexMcpServerSpec;
};

export type CodexMcpImportResult = {
  servers: CodexMcpServerConfig[];
  errors: string[];
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
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

export function normalizeCodexMcpServerSpec(value: unknown): CodexMcpServerSpec {
  const record = toRecord(value) ?? {};
  const inferredType = normalizeText(record.url) && !normalizeText(record.command) ? "http" : "stdio";
  const type = record.type == null || record.type === "" ? inferredType : normalizeCodexMcpTransport(record.type);
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
    const headers = normalizeStringRecord(record.headers ?? record.http_headers);
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

export function validateCodexMcpServerConfig(config: CodexMcpServerConfig): string | null {
  const id = normalizeCodexMcpServerId(config.id);
  if (!id) return "MCP id is required";
  const type = normalizeCodexMcpTransport(config.server?.type);
  if (type === "stdio" && !normalizeText(config.server?.command)) return "stdio MCP is missing command";
  if ((type === "http" || type === "sse") && !normalizeText(config.server?.url)) return `${type} MCP is missing url`;
  return null;
}

export function codexMcpServerSpecToConfigValue(config: CodexMcpServerConfig): Record<string, unknown> {
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
    if (spec.headers && Object.keys(spec.headers).length > 0) out.http_headers = spec.headers;
  }
  for (const [key, value] of Object.entries(spec)) {
    if (key in out || key === "headers") continue;
    if (value == null) continue;
    out[key] = value;
  }
  return out;
}

export function configValueToCodexMcpServerConfig(idValue: unknown, value: unknown): CodexMcpServerConfig | null {
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

export function parseCodexMcpJsonImport(text: string): CodexMcpImportResult {
  const errors: string[] = [];
  const servers: CodexMcpServerConfig[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(text ?? "").trim());
  } catch (error: any) {
    return { servers: [], errors: [`Failed to parse JSON: ${String(error?.message ?? error)}`] };
  }
  const root = toRecord(parsed);
  if (!root) return { servers: [], errors: ["JSON top level must be an object"] };
  const mcpServers = toRecord(root.mcpServers);
  if (mcpServers) {
    for (const [rawId, rawSpec] of Object.entries(mcpServers)) {
      const rawRecord = toRecord(rawSpec);
      const config: CodexMcpServerConfig = {
        id: normalizeCodexMcpServerId(rawId),
        enabled: typeof rawRecord?.enabled === "boolean" ? rawRecord.enabled : true,
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
