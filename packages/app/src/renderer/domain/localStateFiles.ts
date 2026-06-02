import { getCachedUserLocalSettings } from "./localSettings";

function dirnameFromFilePath(value: string): string {
  const filePath = String(value ?? "")
    .trim()
    .replace(/[\\/]+$/, "");
  if (!filePath) return "";
  const slashIndex = filePath.lastIndexOf("/");
  const backslashIndex = filePath.lastIndexOf("\\");
  const index = Math.max(slashIndex, backslashIndex);
  if (index <= 0) return "";
  return filePath.slice(0, index);
}

function detectPathSeparator(value: string): "/" | "\\" {
  const slashIndex = value.lastIndexOf("/");
  const backslashIndex = value.lastIndexOf("\\");
  return backslashIndex > slashIndex ? "\\" : "/";
}

export function resolveLocalStateFilePath(fileName: string): string {
  const localSettingsPath = String(getCachedUserLocalSettings().path ?? "").trim();
  const dir = dirnameFromFilePath(localSettingsPath);
  const name = String(fileName ?? "").trim();
  if (!dir || !name) return "";
  const separator = detectPathSeparator(dir || localSettingsPath);
  return `${dir}${dir.endsWith(separator) ? "" : separator}${name}`;
}
