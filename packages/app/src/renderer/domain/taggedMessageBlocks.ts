import type { MemoryCitation, MemoryCitationEntry } from "@codenexus/generated/codex-app-server/v2";

export type EnvironmentContextBlock = {
  raw: string;
  cwd: string;
  shell: string;
  currentDate: string;
  timezone: string;
};

export type EnvironmentContextSegment =
  | { type: "text"; text: string }
  | { type: "environmentContext"; context: EnvironmentContextBlock };

export type ParsedMemoryCitation = MemoryCitation & {
  raw: string;
};

const ENVIRONMENT_CONTEXT_RE = /<environment_context>([\s\S]*?)<\/environment_context>/gi;
const MEMORY_CITATION_RE = /<oai-mem-c(?:i|a)tation>([\s\S]*?)<\/oai-mem-c(?:i|a)tation>/gi;

function readXmlishTag(body: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<${escapedTag}>([\\s\\S]*?)<\\/${escapedTag}>`, "i").exec(body);
  return String(match?.[1] ?? "").trim();
}

export function parseEnvironmentContext(rawBody: string): EnvironmentContextBlock {
  const raw = String(rawBody ?? "").trim();
  return {
    raw,
    cwd: readXmlishTag(raw, "cwd"),
    shell: readXmlishTag(raw, "shell"),
    currentDate: readXmlishTag(raw, "current_date"),
    timezone: readXmlishTag(raw, "timezone"),
  };
}

export function splitEnvironmentContextSegments(text: string): EnvironmentContextSegment[] {
  const source = String(text ?? "");
  const segments: EnvironmentContextSegment[] = [];
  let lastIndex = 0;

  ENVIRONMENT_CONTEXT_RE.lastIndex = 0;
  for (const match of source.matchAll(ENVIRONMENT_CONTEXT_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const before = source.slice(lastIndex, index);
      if (before) segments.push({ type: "text", text: before });
    }

    segments.push({ type: "environmentContext", context: parseEnvironmentContext(match[1] ?? "") });
    lastIndex = index + String(match[0] ?? "").length;
  }

  if (lastIndex < source.length) {
    const after = source.slice(lastIndex);
    if (after) segments.push({ type: "text", text: after });
  }

  return segments.length > 0 ? segments : source ? [{ type: "text", text: source }] : [];
}

function parseMemoryCitationEntry(line: string): MemoryCitationEntry | null {
  const text = String(line ?? "").trim();
  if (!text) return null;
  const match = /^(.+):(\d+)-(\d+)\|note=\[([\s\S]*)\]$/.exec(text);
  if (!match) return null;
  return {
    path: match[1]?.trim() ?? "",
    lineStart: Number(match[2] ?? 0),
    lineEnd: Number(match[3] ?? 0),
    note: match[4]?.trim() ?? "",
  };
}

export function parseMemoryCitationBlock(rawBody: string): ParsedMemoryCitation {
  const raw = String(rawBody ?? "").trim();
  const entriesBody = readXmlishTag(raw, "citation_entries");
  const rolloutIdsBody = readXmlishTag(raw, "rollout_ids");

  const entries = entriesBody
    .split(/\r?\n/)
    .map(parseMemoryCitationEntry)
    .filter((entry): entry is MemoryCitationEntry => Boolean(entry));
  const threadIds = rolloutIdsBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return { entries, threadIds, raw };
}

export function extractInlineMemoryCitation(text: string): ParsedMemoryCitation | null {
  const source = String(text ?? "");
  MEMORY_CITATION_RE.lastIndex = 0;
  let result: ParsedMemoryCitation | null = null;
  for (const match of source.matchAll(MEMORY_CITATION_RE)) {
    result = parseMemoryCitationBlock(match[1] ?? "");
  }
  return result;
}

export function stripInlineMemoryCitation(text: string): string {
  return String(text ?? "")
    .replace(MEMORY_CITATION_RE, "")
    .trimEnd();
}
