// Diff 渲染模型：把文本 diff 解析为可渲染的行级结构，并标注增删改上下文。
export type DiffLineKind = "meta" | "hunk" | "add" | "del" | "ctx";
export type DiffLine = { kind: DiffLineKind; oldNo: number | null; newNo: number | null; text: string };

export type ParsedDiff = {
  lines: DiffLine[];
  truncated: boolean;
  isUnified: boolean;
};

const MAX_DIFF_LINES = 1400;
const parsedDiffCache = new Map<string, ParsedDiff>();

// 解析 unified diff 文本为行模型，供 Vue 列表直接渲染。
export function parseUnifiedDiffLines(diffText: string): ParsedDiff {
  const text = String(diffText ?? "");
  const rawLines = text.split(/\r?\n/);
  const lines: DiffLine[] = [];
  let truncated = false;
  let isUnified = false;

  let inHunk = false;
  let oldNo = 0;
  let newNo = 0;

  // 超过上限后停止继续解析，防止超大 diff 卡界面。
  const push = (line: DiffLine) => {
    lines.push(line);
    if (lines.length >= MAX_DIFF_LINES) truncated = true;
  };

  for (let i = 0; i < rawLines.length; i += 1) {
    if (truncated) break;
    const line = rawLines[i] ?? "";

    if (line.startsWith("@@")) {
      const m = /@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/.exec(line);
      if (m) {
        isUnified = true;
        inHunk = true;
        oldNo = Math.max(0, Number.parseInt(m[1] || "0", 10));
        newNo = Math.max(0, Number.parseInt(m[3] || "0", 10));
      }
      push({ kind: "hunk", oldNo: null, newNo: null, text: line });
      continue;
    }

    if (/^(diff |index |--- |\+\+\+ )/.test(line)) {
      push({ kind: "meta", oldNo: null, newNo: null, text: line });
      continue;
    }

    if (inHunk && line.startsWith("+") && !line.startsWith("+++")) {
      push({ kind: "add", oldNo: null, newNo, text: line });
      newNo += 1;
      continue;
    }

    if (inHunk && line.startsWith("-") && !line.startsWith("---")) {
      push({ kind: "del", oldNo, newNo: null, text: line });
      oldNo += 1;
      continue;
    }

    if (inHunk) {
      push({ kind: "ctx", oldNo, newNo, text: line });
      oldNo += 1;
      newNo += 1;
      continue;
    }

    push({ kind: "ctx", oldNo: i + 1, newNo: null, text: line });
  }

  return { lines, truncated, isUnified };
}

// 读取/写入解析缓存，避免同一 diff 反复 parse。
export function getParsedDiffCached(diffText: string): ParsedDiff {
  const key = String(diffText ?? "");
  const cached = parsedDiffCache.get(key);
  if (cached) return cached;
  const parsed = parseUnifiedDiffLines(key);
  parsedDiffCache.set(key, parsed);
  return parsed;
}

export function getParsedDiffCacheStats(): { items: number; bytes: number; updatedAt: number } {
  let bytes = 0;
  for (const [key, value] of parsedDiffCache.entries()) {
    bytes += key.length;
    bytes += JSON.stringify(value).length;
  }
  return {
    items: parsedDiffCache.size,
    bytes: Math.max(0, Math.round(bytes)),
    updatedAt: Date.now(),
  };
}

export function clearParsedDiffCache(): void {
  parsedDiffCache.clear();
}
