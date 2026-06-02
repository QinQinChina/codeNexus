import { join } from "node:path";

export type FileExists = (path: string) => boolean;

function normalizePathLine(value: unknown): string {
  return String(value ?? "").trim();
}

function pushUnique(paths: string[], value: string): void {
  const path = normalizePathLine(value);
  if (!path) return;
  const key = path.toLowerCase();
  if (paths.some((existing) => existing.toLowerCase() === key)) return;
  paths.push(path);
}

export function splitWhereOutput(stdout: string): string[] {
  return String(stdout ?? "")
    .split(/\r?\n/)
    .map(normalizePathLine)
    .filter(Boolean);
}

export function npmCodexCmdPathFromAppData(appDataValue: unknown): string {
  const appData = normalizePathLine(appDataValue);
  return appData ? join(appData, "npm", "codex.cmd") : "";
}

export function discoverExistingCodexPaths(args: {
  whereStdout?: string;
  appData?: string;
  exists: FileExists;
}): string[] {
  const exists = args.exists;
  const paths: string[] = [];

  for (const candidate of splitWhereOutput(args.whereStdout ?? "")) {
    if (exists(candidate)) pushUnique(paths, candidate);
  }

  const appDataCandidate = npmCodexCmdPathFromAppData(args.appData);
  if (appDataCandidate && exists(appDataCandidate)) pushUnique(paths, appDataCandidate);

  return paths;
}
