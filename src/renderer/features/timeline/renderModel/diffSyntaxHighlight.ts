import {
  clearCodeSyntaxHighlightCache,
  getCodeSyntaxHighlightCacheStats,
  highlightCodeTokens,
  inferLanguageFromPath,
  type SyntaxHighlightToken,
} from "./codeSyntaxHighlight";
import { getParsedDiffCached, type DiffLine } from "./diff";

export type DiffHighlightTone = "light" | "dark";

export type DiffHighlightToken = SyntaxHighlightToken;

const RESULT_CACHE_MAX = 90;
const RESULT_CACHE_KEEP = 70;

const resultCache = new Map<string, Record<number, DiffHighlightToken[]>>();

type SegmentEntry = { lineIndex: number; content: string };

type DiffHighlightSegment = {
  fileHint: string;
  lineIndexes: number[];
  oldEntries: SegmentEntry[];
  newEntries: SegmentEntry[];
};

const pruneCache = <T>(store: Map<string, T>, max: number, keep: number) => {
  if (store.size <= max) return;
  const staleKeys = [...store.keys()].slice(0, Math.max(0, store.size - keep));
  for (const key of staleKeys) store.delete(key);
};

const normalizePath = (value: string) => {
  const trimmed = String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed === "/dev/null") return "";
  const normalized = trimmed.replace(/\\/g, "/");
  return /^[ab]\//.test(normalized) ? normalized.slice(2) : normalized;
};

const parseDiffGitHeader = (line: string) => {
  const source = String(line ?? "").trim();
  const match = /^diff --git\s+"?a\/(.+?)"?\s+"?b\/(.+?)"?$/.exec(source);
  if (!match) return { oldPath: "", newPath: "" };
  return {
    oldPath: normalizePath(`a/${match[1] ?? ""}`),
    newPath: normalizePath(`b/${match[2] ?? ""}`),
  };
};

const normalizeCodeLineContent = (line: DiffLine) => {
  const text = String(line.text ?? "");
  if (line.kind === "add" || line.kind === "del") {
    return /^[+-]/.test(text) ? text.slice(1) : text;
  }
  if (line.kind === "ctx") {
    return text.startsWith(" ") ? text.slice(1) : text;
  }
  return text;
};

const softenDiffTokenStyle = (
  style: Record<string, string>,
  kind: DiffLine["kind"]
): Record<string, string> => {
  if (kind !== "add" && kind !== "del") return style;
  const next = { ...style };
  if (!next.fontWeight) next.fontWeight = "500";
  return next;
};

const tokenizeCodeLines = async (
  codeLines: string[],
  language: string,
  tone: DiffHighlightTone
): Promise<DiffHighlightToken[][]> => {
  if (codeLines.length === 0) return [];
  if (language === "text") return [];
  return highlightCodeTokens({
    code: codeLines.join("\n"),
    language,
    tone,
  });
};

const buildHighlightSegments = (lines: DiffLine[], filePathHint: string): DiffHighlightSegment[] => {
  const segments: DiffHighlightSegment[] = [];
  let currentFileHint = normalizePath(filePathHint);
  let currentSegment: DiffHighlightSegment | null = null;

  const closeSegment = () => {
    if (!currentSegment) return;
    if (currentSegment.oldEntries.length > 0 || currentSegment.newEntries.length > 0) {
      segments.push(currentSegment);
    }
    currentSegment = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.kind === "meta") {
      const header = parseDiffGitHeader(line.text);
      if (header.newPath || header.oldPath) currentFileHint = header.newPath || header.oldPath;
      closeSegment();
      continue;
    }
    if (line.kind === "hunk") {
      closeSegment();
      currentSegment = {
        fileHint: currentFileHint,
        lineIndexes: [],
        oldEntries: [],
        newEntries: [],
      };
      continue;
    }

    if (!currentSegment) {
      currentSegment = {
        fileHint: currentFileHint,
        lineIndexes: [],
        oldEntries: [],
        newEntries: [],
      };
    }

    currentSegment.lineIndexes.push(index);
    const content = normalizeCodeLineContent(line);
    if (line.kind === "ctx") {
      currentSegment.oldEntries.push({ lineIndex: index, content });
      currentSegment.newEntries.push({ lineIndex: index, content });
      continue;
    }
    if (line.kind === "del") {
      currentSegment.oldEntries.push({ lineIndex: index, content });
      continue;
    }
    if (line.kind === "add") {
      currentSegment.newEntries.push({ lineIndex: index, content });
    }
  }

  closeSegment();
  return segments;
};

export async function highlightDiffTokens(args: {
  diffText: string;
  filePathHint?: string;
  tone: DiffHighlightTone;
}): Promise<Record<number, DiffHighlightToken[]>> {
  const diffText = String(args.diffText ?? "");
  const filePathHint = String(args.filePathHint ?? "");
  const tone = args.tone === "light" ? "light" : "dark";
  const resultKey = `${tone}::${filePathHint}::${diffText}`;
  const cached = resultCache.get(resultKey);
  if (cached) return cached;

  const parsed = getParsedDiffCached(diffText);
  const segments = buildHighlightSegments(parsed.lines, filePathHint);
  const result: Record<number, DiffHighlightToken[]> = {};

  for (const segment of segments) {
    const language = inferLanguageFromPath(segment.fileHint);
    if (language === "text") continue;

    const oldTokenLines = await tokenizeCodeLines(
      segment.oldEntries.map((entry) => entry.content),
      language,
      tone
    );
    const newTokenLines = await tokenizeCodeLines(
      segment.newEntries.map((entry) => entry.content),
      language,
      tone
    );

    let oldCursor = 0;
    let newCursor = 0;

    for (const lineIndex of segment.lineIndexes) {
      const line = parsed.lines[lineIndex];
      if (line.kind === "ctx") {
        const tokens = newTokenLines[newCursor] ?? oldTokenLines[oldCursor] ?? [];
        if (tokens.length > 0) result[lineIndex] = tokens;
        oldCursor += 1;
        newCursor += 1;
        continue;
      }
      if (line.kind === "del") {
        const tokens = (oldTokenLines[oldCursor] ?? []).map((token) => ({
          ...token,
          style: softenDiffTokenStyle(token.style, line.kind),
        }));
        if (tokens.length > 0) result[lineIndex] = tokens;
        oldCursor += 1;
        continue;
      }
      if (line.kind === "add") {
        const tokens = (newTokenLines[newCursor] ?? []).map((token) => ({
          ...token,
          style: softenDiffTokenStyle(token.style, line.kind),
        }));
        if (tokens.length > 0) result[lineIndex] = tokens;
        newCursor += 1;
      }
    }
  }

  resultCache.set(resultKey, result);
  pruneCache(resultCache, RESULT_CACHE_MAX, RESULT_CACHE_KEEP);
  return result;
}

export function getDiffSyntaxHighlightCacheStats(): { items: number; bytes: number; updatedAt: number } {
  const codeStats = getCodeSyntaxHighlightCacheStats();
  let bytes = codeStats.bytes;
  for (const [key, value] of resultCache.entries()) {
    bytes += key.length;
    bytes += JSON.stringify(value).length;
  }
  return {
    items: codeStats.items + resultCache.size,
    bytes: Math.max(0, Math.round(bytes)),
    updatedAt: Date.now(),
  };
}

export function clearDiffSyntaxHighlightCache(): void {
  clearCodeSyntaxHighlightCache();
  resultCache.clear();
}
