export type PathHighlightToken = { kind: "text"; value: string } | { kind: "path"; value: string };

const CANDIDATE_REGEX = /[^\s]+[\\/][^\s]+/g;

const TRIM_LEFT_CHARS = new Set(["(", "[", "{", "<", '"', "'", "“", "‘", "（", "【", "《"]);
const TRIM_RIGHT_CHARS = new Set([
  ")",
  "]",
  "}",
  ">",
  '"',
  "'",
  "”",
  "’",
  ",",
  ".",
  ";",
  "!",
  "?",
  "，",
  "。",
  "；",
  "！",
  "？",
  "）",
  "】",
  "》",
]);

const KNOWN_REPO_PREFIX_REGEX = /^(src|packages|apps|docs|scripts|test|tests|build|dist)[\\/]/i;
const RELATIVE_PREFIX_REGEX = /^(\.{1,2}[\\/]|~[\\/])/;
const WINDOWS_ABSOLUTE_REGEX = /^[A-Za-z]:[\\/]/;
const UNC_ABSOLUTE_REGEX = /^(\\\\|\/\/)[^\s]+/;
const UNIX_ABSOLUTE_REGEX = /^\//;
const URL_LIKE_REGEX = /:\/\//;
const KNOWN_EXTENSION_REGEX = /\.(ts|tsx|js|jsx|vue|json|md|yml|yaml|toml|cjs|mjs|css|html|sh)(?=($|[:#][A-Za-z0-9]))/i;

export type ParsedPathToken = {
  full: string;
  core: string;
  suffix: string;
  basename: string;
  segments: string[];
};

function countSeparators(value: string): number {
  let count = 0;
  for (const ch of value) {
    if (ch === "/" || ch === "\\") count += 1;
  }
  return count;
}

function splitCandidatePunctuation(raw: string): { leading: string; core: string; trailing: string } {
  let start = 0;
  let end = raw.length;
  while (start < end && TRIM_LEFT_CHARS.has(raw[start] ?? "")) start += 1;
  while (end > start && TRIM_RIGHT_CHARS.has(raw[end - 1] ?? "")) end -= 1;
  return { leading: raw.slice(0, start), core: raw.slice(start, end), trailing: raw.slice(end) };
}

function isPathLikeCore(coreValue: string): boolean {
  const core = String(coreValue ?? "").trim();
  if (!core) return false;
  // Exclude URLs (e.g. https://example.com/a/b)
  if (URL_LIKE_REGEX.test(core)) return false;

  if (WINDOWS_ABSOLUTE_REGEX.test(core)) return true;
  if (UNC_ABSOLUTE_REGEX.test(core)) return true;
  if (UNIX_ABSOLUTE_REGEX.test(core)) return true;
  if (RELATIVE_PREFIX_REGEX.test(core)) return true;
  if (KNOWN_REPO_PREFIX_REGEX.test(core)) return true;
  if (KNOWN_EXTENSION_REGEX.test(core)) return true;

  const separators = countSeparators(core);
  // Heuristic fallback for folder-like paths (avoid matching short ratios like a/b).
  if (separators >= 2 && core.length >= 6) return true;

  return false;
}

export function isPathLikeStrict(textValue: string): boolean {
  const text = String(textValue ?? "").trim();
  if (!text) return false;
  if (!text.includes("/") && !text.includes("\\")) return false;
  // Exclude URLs
  if (URL_LIKE_REGEX.test(text)) return false;
  const split = splitCandidatePunctuation(text);
  return Boolean(split.core) && isPathLikeCore(split.core);
}

function normalizeSlashes(value: string): string {
  return String(value ?? "").replace(/\\/g, "/");
}

function extractSuffix(value: string): { core: string; suffix: string } {
  const text = String(value ?? "").trim();
  if (!text) return { core: "", suffix: "" };

  // Support :line[:col] suffix
  const colonMatch = text.match(/^(.*?)(:\d+(?::\d+)?)$/);
  if (colonMatch) {
    return { core: colonMatch[1] ?? "", suffix: colonMatch[2] ?? "" };
  }

  // Support #Lline[Ccol] suffix
  const anchorMatch = text.match(/^(.*?)(#L\d+(?:C\d+)?)$/i);
  if (anchorMatch) {
    return { core: anchorMatch[1] ?? "", suffix: anchorMatch[2] ?? "" };
  }

  return { core: text, suffix: "" };
}

function splitSegments(core: string): string[] {
  const normalized = normalizeSlashes(core);
  return normalized.split("/").filter(Boolean);
}

function basenameFromSegments(segments: string[]): string {
  return segments.length > 0 ? (segments[segments.length - 1] ?? "") : "";
}

export function parsePathToken(value: string): ParsedPathToken | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const split = splitCandidatePunctuation(raw);
  const trimmed = split.core;
  if (!trimmed) return null;
  if (URL_LIKE_REGEX.test(trimmed)) return null;

  const { core, suffix } = extractSuffix(trimmed);
  if (!core) return null;
  if (!isPathLikeCore(core)) return null;

  const segments = splitSegments(core);
  const basename = basenameFromSegments(segments);
  if (!basename) return null;

  return {
    full: trimmed,
    core,
    suffix,
    basename,
    segments,
  };
}

export function summarizeParsedPath(parsed: ParsedPathToken, segmentCount: number): string {
  const segments = Array.isArray(parsed.segments) ? parsed.segments : [];
  const n = Math.max(1, Math.min(segments.length, Math.round(Number(segmentCount) || 1)));
  const head = segments.slice(Math.max(0, segments.length - n)).join("/");
  const suffix = String(parsed.suffix ?? "");
  return `${head}${suffix}`;
}

function pushText(tokens: PathHighlightToken[], value: string) {
  if (!value) return;
  const last = tokens[tokens.length - 1];
  if (last?.kind === "text") {
    last.value += value;
    return;
  }
  tokens.push({ kind: "text", value });
}

function pushPath(tokens: PathHighlightToken[], value: string) {
  if (!value) return;
  tokens.push({ kind: "path", value });
}

export function tokenizePathLikeText(textValue: string): PathHighlightToken[] {
  const text = String(textValue ?? "");
  if (!text) return [{ kind: "text", value: "" }];
  if (!text.includes("/") && !text.includes("\\")) return [{ kind: "text", value: text }];

  const tokens: PathHighlightToken[] = [];
  let lastIndex = 0;

  CANDIDATE_REGEX.lastIndex = 0;
  while (true) {
    const match = CANDIDATE_REGEX.exec(text);
    if (!match) break;
    const rawCandidate = match[0] ?? "";
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + rawCandidate.length;

    if (matchStart > lastIndex) pushText(tokens, text.slice(lastIndex, matchStart));

    const split = splitCandidatePunctuation(rawCandidate);
    if (!split.core || !isPathLikeCore(split.core)) {
      // Not a path: keep the original segment untouched.
      pushText(tokens, rawCandidate);
      lastIndex = matchEnd;
      continue;
    }

    if (split.leading) pushText(tokens, split.leading);
    pushPath(tokens, split.core);
    if (split.trailing) pushText(tokens, split.trailing);

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) pushText(tokens, text.slice(lastIndex));
  if (tokens.length === 0) return [{ kind: "text", value: text }];

  return tokens;
}
