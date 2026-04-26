const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

// 统一外链白名单：仅允许显式的安全协议，避免意外执行本地/脚本协议。
export function normalizeSafeExternalUrl(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol ?? "").toLowerCase();
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(protocol)) return "";
    if ((protocol === "http:" || protocol === "https:") && !parsed.hostname) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}
