// Sandbox 策略映射：在 UI 与服务端/协议枚举之间做格式转换与校验。
import type { SandboxMode } from "../../generated/codex-app-server/v2/SandboxMode";

export type SandboxEnumStyle = "kebab" | "camel";
type SandboxSemantic = "readOnly" | "workspaceWrite" | "dangerFullAccess" | "externalSandbox";
export type SandboxPolicyKebab = SandboxMode;
export type SandboxPolicyCamel = "readOnly" | "workspaceWrite" | "dangerFullAccess" | "externalSandbox";

// 注意：codex app-server 协议里同一类“沙箱”枚举在不同字段/方法中可能使用不同命名风格：
// - 例如 v2 的 `thread/start` 入参 `sandbox` 使用 kebab-case（read-only/workspace-write/danger-full-access）
// - 而 v2 的 `turn/start` 入参 `sandboxPolicy.type` 使用 camelCase（readOnly/workspaceWrite/dangerFullAccess/externalSandbox）
// 因此这里同时保留两种编码方式，并由调用方按 RPC 选择 style。
// 如需核对当前本机 codex 的协议定义，可在任意本地目录执行 `codex app-server generate-json-schema --out <dir>`
function normalizeSandboxSemantic(mode: string): SandboxSemantic {
  const raw = String(mode ?? "").trim();
  const lower = raw.toLowerCase();
  if (raw === "readOnly" || lower === "read-only" || lower === "readonly") return "readOnly";
  if (raw === "workspaceWrite" || lower === "workspace-write" || lower === "workspacewrite") return "workspaceWrite";
  if (raw === "dangerFullAccess" || lower === "danger-full-access" || lower === "dangerfullaccess")
    return "dangerFullAccess";
  if (raw === "externalSandbox" || lower === "external-sandbox" || lower === "externalsandbox")
    return "externalSandbox";
  return "workspaceWrite";
}

function semanticToKebab(semantic: SandboxSemantic): SandboxPolicyKebab {
  if (semantic === "readOnly") return "read-only";
  if (semantic === "workspaceWrite") return "workspace-write";
  return "danger-full-access";
}

function semanticToCamel(semantic: SandboxSemantic): SandboxPolicyCamel {
  if (semantic === "readOnly") return "readOnly";
  if (semantic === "workspaceWrite") return "workspaceWrite";
  if (semantic === "externalSandbox") return "externalSandbox";
  return "dangerFullAccess";
}

export function sandboxValueFromUi(mode: string, style: SandboxEnumStyle): SandboxPolicyKebab | SandboxPolicyCamel {
  const semantic = normalizeSandboxSemantic(mode);
  return style === "camel" ? semanticToCamel(semantic) : semanticToKebab(semantic);
}

// 把 UI 下拉值映射为服务端 kebab-case 枚举。
export function sandboxKebabFromUi(mode: string): SandboxPolicyKebab {
  return semanticToKebab(normalizeSandboxSemantic(mode));
}

// 统一构造 sandbox policy 请求体，workspace-write/workspaceWrite 时附带可写目录。
export function sandboxPolicyFromUi(mode: string, cwd: string, style: SandboxEnumStyle = "kebab") {
  const type = sandboxValueFromUi(mode, style);
  const networkAccess = true;
  if (type === "workspace-write" || type === "workspaceWrite")
    return { type, writableRoots: cwd ? [cwd] : [], networkAccess };
  return { type, networkAccess };
}
