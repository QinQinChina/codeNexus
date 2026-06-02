export function isAbsoluteFsPath(value: string): boolean {
  const path = String(value ?? "").trim();
  if (!path) return false;
  if (/^[A-Za-z]:[\\/]/.test(path)) return true;
  if (path.startsWith("\\\\") || path.startsWith("//")) return true;
  if (path.startsWith("/") || path.startsWith("\\")) return true;
  return false;
}

function splitAbsolutePrefix(value: string): { prefix: string; rest: string } | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!normalized) return null;
  if (/^[A-Za-z]:/.test(normalized)) {
    return { prefix: normalized.slice(0, 2), rest: normalized.slice(2) };
  }
  const unc = normalized.match(/^\/\/[^/]+\/[^/]+/);
  if (unc) {
    return { prefix: unc[0], rest: normalized.slice(unc[0].length) };
  }
  if (normalized.startsWith("/")) {
    return { prefix: "/", rest: normalized.slice(1) };
  }
  return null;
}

export function normalizeAbsoluteFsPath(value: string): string {
  const parts = splitAbsolutePrefix(value);
  if (!parts) return "";
  const segments: string[] = [];
  for (const segment of parts.rest.split("/")) {
    const item = String(segment ?? "").trim();
    if (!item || item === ".") continue;
    if (item === "..") {
      if (segments.length > 0) segments.pop();
      continue;
    }
    segments.push(item);
  }
  if (parts.prefix === "/") {
    return segments.length > 0 ? `/${segments.join("/")}` : "/";
  }
  if (parts.prefix.startsWith("//")) {
    return segments.length > 0 ? `${parts.prefix}/${segments.join("/")}` : parts.prefix;
  }
  return segments.length > 0 ? `${parts.prefix}/${segments.join("/")}` : `${parts.prefix}/`;
}

function normalizeComparableFsPath(value: string): string {
  const normalized = normalizeAbsoluteFsPath(value);
  if (!normalized) return "";
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")) {
    return normalized.toLowerCase();
  }
  return normalized;
}

export function resolveWorkspaceFsPath(workspaceRoot: string, inputPath: string): string {
  const workspace = normalizeAbsoluteFsPath(workspaceRoot);
  if (!workspace) return "";
  const path = String(inputPath ?? "").trim();
  if (!path) return workspace;
  if (isAbsoluteFsPath(path)) return normalizeAbsoluteFsPath(path);
  return normalizeAbsoluteFsPath(`${workspace.replace(/\/+$/g, "")}/${path.replace(/^[\\/]+/g, "")}`);
}

export function isWithinWorkspaceFsPath(workspaceRoot: string, targetPath: string): boolean {
  const workspace = normalizeComparableFsPath(resolveWorkspaceFsPath(workspaceRoot, workspaceRoot));
  const target = normalizeComparableFsPath(resolveWorkspaceFsPath(workspaceRoot, targetPath));
  if (!workspace || !target) return false;
  if (workspace === target) return true;
  const prefix = workspace.endsWith("/") ? workspace : `${workspace}/`;
  return target.startsWith(prefix);
}
