import type { TextElement } from "../../generated/codex-app-server/v2/TextElement";
import type { ComposeWorkspaceFileMention, TextUserInput, UserTurnInput } from "./types";
import { basenameFromPath } from "./workspaceFiles";
import { normalizeAbsoluteFsPath } from "./workspacePath";

export const COMPOSE_FILE_TOKEN_CHAR = "\uFFFC";

const textEncoder = new TextEncoder();

export type ComposeSegment = { type: "text"; text: string } | { type: "mention"; mention: ComposeWorkspaceFileMention };

export type StructuredTextSegment =
  | { type: "text"; text: string }
  | { type: "file"; path: string; placeholder: string | null };

function normalizeComposeText(value: string): string {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function createMentionId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function utf8ByteLength(value: string): number {
  return textEncoder.encode(String(value ?? "")).length;
}

function buildUtf8ByteBoundaries(text: string): Array<{ byte: number; utf16: number }> {
  const boundaries = [{ byte: 0, utf16: 0 }];
  let byte = 0;
  let utf16 = 0;
  for (const char of String(text ?? "")) {
    utf16 += char.length;
    byte += utf8ByteLength(char);
    boundaries.push({ byte, utf16 });
  }
  return boundaries;
}

function utf16OffsetFromByte(
  boundaries: Array<{ byte: number; utf16: number }>,
  byteValue: number,
  fallbackUtf16: number
): number {
  if (!Number.isFinite(byteValue)) return 0;
  const target = Math.max(0, Math.round(byteValue));
  let low = 0;
  let high = boundaries.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const current = boundaries[mid];
    if (current.byte === target) return current.utf16;
    if (current.byte < target) low = mid + 1;
    else high = mid - 1;
  }
  if (high >= 0 && high < boundaries.length) return boundaries[high].utf16;
  return fallbackUtf16;
}

function dedupeTextElements(values: TextElement[]): TextElement[] {
  const seen = new Set<string>();
  const result: TextElement[] = [];
  for (const value of values) {
    const key = `${value.byteRange.start}:${value.byteRange.end}:${String(value.placeholder ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function inferAbsolutePathTextElements(textValue: string): TextElement[] {
  const text = String(textValue ?? "");
  if (!text) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();

  const addRange = (startValue: number, endValue: number) => {
    const start = Math.max(0, Math.round(startValue));
    const end = Math.min(text.length, Math.round(endValue));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const raw = text.slice(start, end);
    const path = normalizeAbsoluteFsPath(raw);
    if (!path) return;
    const key = `${start}:${end}:${path.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    ranges.push({ start, end });
  };

  let lineStart = 0;
  while (lineStart <= text.length) {
    const nextBreak = text.indexOf("\n", lineStart);
    const lineEnd = nextBreak >= 0 ? nextBreak : text.length;
    const line = text.slice(lineStart, lineEnd);
    const trimmed = line.trim();
    if (trimmed) {
      const normalized = normalizeAbsoluteFsPath(trimmed);
      if (normalized) {
        const leading = line.indexOf(trimmed);
        addRange(lineStart + Math.max(0, leading), lineStart + Math.max(0, leading) + trimmed.length);
      }
    }
    if (nextBreak < 0) break;
    lineStart = nextBreak + 1;
  }

  const quotedPathPattern = /`([^`\r\n]+)`|"([^"\r\n]+)"|'([^'\r\n]+)'/g;
  for (const match of text.matchAll(quotedPathPattern)) {
    const raw = String(match[1] ?? match[2] ?? match[3] ?? "");
    if (!normalizeAbsoluteFsPath(raw)) continue;
    const whole = String(match[0] ?? "");
    const offsetInWhole = whole.indexOf(raw);
    if (offsetInWhole < 0) continue;
    const start = Number(match.index ?? 0) + offsetInWhole;
    addRange(start, start + raw.length);
  }

  const inlineWindowsPathPattern = /(^|[\s(（\["'])((?:[A-Za-z]:[\\/]|\\\\)[^\s"'`<>|?*，。；;：:！!？?\)\]】》]+)/g;
  for (const match of text.matchAll(inlineWindowsPathPattern)) {
    const lead = String(match[1] ?? "");
    const raw = String(match[2] ?? "");
    if (!normalizeAbsoluteFsPath(raw)) continue;
    const start = Number(match.index ?? 0) + lead.length;
    addRange(start, start + raw.length);
  }

  return dedupeTextElements(
    ranges
      .map<TextElement | null>((range) => {
        const raw = text.slice(range.start, range.end);
        const path = normalizeAbsoluteFsPath(raw);
        if (!path) return null;
        return {
          byteRange: {
            start: utf8ByteLength(text.slice(0, range.start)),
            end: utf8ByteLength(text.slice(0, range.end)),
          },
          placeholder: basenameFromPath(path) || path,
        };
      })
      .filter((value): value is TextElement => value != null)
      .sort((a, b) => {
        if (a.byteRange.start !== b.byteRange.start) return a.byteRange.start - b.byteRange.start;
        return a.byteRange.end - b.byteRange.end;
      })
  );
}

export function normalizeComposeTextElement(value: unknown): TextElement | null {
  const record = toRecord(value);
  const byteRangeRecord = toRecord(record?.byteRange) ?? toRecord(record?.byte_range);
  const start = Number(byteRangeRecord?.start ?? record?.start);
  const end = Number(byteRangeRecord?.end ?? record?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    byteRange: {
      start: Math.max(0, Math.round(start)),
      end: Math.max(0, Math.round(end)),
    },
    placeholder:
      record?.placeholder == null ? (record?.label == null ? null : String(record.label)) : String(record.placeholder),
  };
}

export function cloneComposeTextElements(values: TextElement[] | undefined): TextElement[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  return values
    .map((value) => normalizeComposeTextElement(value))
    .filter((value): value is TextElement => value != null);
}

export function normalizeComposeTextElements(values: unknown): TextElement[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  return dedupeTextElements(
    values
      .map((value) => normalizeComposeTextElement(value))
      .filter((value): value is TextElement => value != null)
      .sort((a, b) => {
        if (a.byteRange.start !== b.byteRange.start) return a.byteRange.start - b.byteRange.start;
        return a.byteRange.end - b.byteRange.end;
      })
  );
}

export function resolveComposeTextElements(
  textValue: string,
  textElementsValue: unknown,
  options?: { inferAbsolutePaths?: boolean }
): TextElement[] {
  const text = String(textValue ?? "");
  const textElements = normalizeComposeTextElements(textElementsValue);
  if (textElements.length > 0) return textElements;
  if (!(options?.inferAbsolutePaths ?? false)) return [];
  return inferAbsolutePathTextElements(text);
}

export function countComposeFileTokens(value: string): number {
  let count = 0;
  const text = String(value ?? "");
  for (const char of text) {
    if (char === COMPOSE_FILE_TOKEN_CHAR) count += 1;
  }
  return count;
}

export function countComposeFileTokensBeforeOffset(value: string, offsetValue: number): number {
  const text = String(value ?? "");
  const offset = Math.max(0, Math.min(text.length, Math.round(offsetValue)));
  let count = 0;
  for (let index = 0; index < offset; index += 1) {
    if (text[index] === COMPOSE_FILE_TOKEN_CHAR) count += 1;
  }
  return count;
}

export function findComposeFileTokenOffsetByMentionIndex(value: string, mentionIndexValue: number): number {
  if (!Number.isFinite(mentionIndexValue) || mentionIndexValue < 0) return -1;
  const text = String(value ?? "");
  const mentionIndex = Math.round(mentionIndexValue);
  let currentMentionIndex = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== COMPOSE_FILE_TOKEN_CHAR) continue;
    if (currentMentionIndex === mentionIndex) return index;
    currentMentionIndex += 1;
  }
  return -1;
}

export function stripComposeFileTokenChars(value: string): string {
  return String(value ?? "")
    .split(COMPOSE_FILE_TOKEN_CHAR)
    .join("");
}

export function hasMeaningfulComposeText(value: string): boolean {
  return Boolean(stripComposeFileTokenChars(value).trim());
}

export function createComposeFileMention(
  pathValue: string,
  options?: { id?: string; idPrefix?: string }
): ComposeWorkspaceFileMention | null {
  const path = normalizeAbsoluteFsPath(pathValue);
  if (!path) return null;
  const id = String(options?.id ?? "").trim() || createMentionId(String(options?.idPrefix ?? "compose-file"));
  return {
    id,
    path,
  };
}

export function buildComposeSegments(
  composeInputValue: string,
  mentionsValue: ComposeWorkspaceFileMention[]
): ComposeSegment[] {
  const composeInput = String(composeInputValue ?? "");
  const mentions = Array.isArray(mentionsValue) ? mentionsValue : [];
  const segments: ComposeSegment[] = [];
  let textBuffer = "";
  let mentionIndex = 0;

  const flushTextBuffer = () => {
    if (!textBuffer) return;
    segments.push({ type: "text", text: textBuffer });
    textBuffer = "";
  };

  for (const char of composeInput) {
    if (char !== COMPOSE_FILE_TOKEN_CHAR) {
      textBuffer += char;
      continue;
    }
    flushTextBuffer();
    const mention = mentions[mentionIndex] ?? null;
    mentionIndex += 1;
    if (!mention) continue;
    segments.push({ type: "mention", mention });
  }

  flushTextBuffer();

  for (; mentionIndex < mentions.length; mentionIndex += 1) {
    const mention = mentions[mentionIndex];
    if (!mention) continue;
    segments.push({ type: "mention", mention });
  }

  return segments;
}

export function buildTextUserInputFromComposeDraft(
  composeInputValue: string,
  mentionsValue: ComposeWorkspaceFileMention[]
): TextUserInput | null {
  const textParts: string[] = [];
  const textElements: TextElement[] = [];
  let currentByte = 0;

  for (const segment of buildComposeSegments(composeInputValue, mentionsValue)) {
    if (segment.type === "text") {
      const text = normalizeComposeText(segment.text);
      textParts.push(text);
      currentByte += utf8ByteLength(text);
      continue;
    }

    const path = normalizeAbsoluteFsPath(segment.mention.path);
    if (!path) continue;
    textParts.push(path);
    const start = currentByte;
    currentByte += utf8ByteLength(path);
    textElements.push({
      byteRange: {
        start,
        end: currentByte,
      },
      placeholder: basenameFromPath(path) || path,
    });
  }

  const text = textParts.join("");
  if (!text && textElements.length === 0) return null;
  return {
    type: "text",
    text,
    ...(textElements.length > 0 ? { text_elements: textElements } : {}),
  };
}

export function buildStructuredTextSegments(
  textValue: string,
  textElementsValue: unknown,
  options?: { inferAbsolutePaths?: boolean }
): StructuredTextSegment[] {
  const text = String(textValue ?? "");
  if (!text) return [];

  const textElements = resolveComposeTextElements(text, textElementsValue, options);
  if (textElements.length === 0) return [{ type: "text", text }];

  const boundaries = buildUtf8ByteBoundaries(text);
  const totalBytes = boundaries[boundaries.length - 1]?.byte ?? 0;
  const segments: StructuredTextSegment[] = [];
  let cursorUtf16 = 0;

  for (const textElement of textElements) {
    const startByte = Math.max(0, Math.min(totalBytes, textElement.byteRange.start));
    const endByte = Math.max(startByte, Math.min(totalBytes, textElement.byteRange.end));
    if (endByte <= startByte) continue;

    const startUtf16 = utf16OffsetFromByte(boundaries, startByte, text.length);
    const endUtf16 = utf16OffsetFromByte(boundaries, endByte, text.length);
    if (endUtf16 <= startUtf16 || startUtf16 < cursorUtf16) continue;

    if (startUtf16 > cursorUtf16) {
      const plainText = text.slice(cursorUtf16, startUtf16);
      if (plainText) segments.push({ type: "text", text: plainText });
    }

    const rawPath = text.slice(startUtf16, endUtf16);
    const path = normalizeAbsoluteFsPath(rawPath) || String(rawPath ?? "").trim();
    if (path) {
      segments.push({
        type: "file",
        path,
        placeholder: textElement.placeholder == null ? basenameFromPath(path) || path : String(textElement.placeholder),
      });
    } else if (rawPath) {
      segments.push({ type: "text", text: rawPath });
    }

    cursorUtf16 = endUtf16;
  }

  if (cursorUtf16 < text.length) {
    const tail = text.slice(cursorUtf16);
    if (tail) segments.push({ type: "text", text: tail });
  }

  return segments.length > 0 ? segments : [{ type: "text", text }];
}

export function buildComposeDraftFromStructuredText(
  textValue: string,
  textElementsValue: unknown,
  options?: { inferAbsolutePaths?: boolean; idPrefix?: string }
): {
  composeInput: string;
  composeFileMentions: ComposeWorkspaceFileMention[];
} {
  const composeParts: string[] = [];
  const composeFileMentions: ComposeWorkspaceFileMention[] = [];

  for (const segment of buildStructuredTextSegments(textValue, textElementsValue, options)) {
    if (segment.type === "text") {
      composeParts.push(normalizeComposeText(segment.text));
      continue;
    }
    const mention = createComposeFileMention(segment.path, {
      idPrefix: String(options?.idPrefix ?? "queue-file"),
    });
    if (!mention) {
      composeParts.push(segment.path);
      continue;
    }
    composeParts.push(COMPOSE_FILE_TOKEN_CHAR);
    composeFileMentions.push(mention);
  }

  return {
    composeInput: composeParts.join(""),
    composeFileMentions,
  };
}

export function buildComposeDraftFromUserTurnInputs(values: UserTurnInput[]): {
  composeInput: string;
  composeFileMentions: ComposeWorkspaceFileMention[];
} {
  const composeParts: string[] = [];
  const composeFileMentions: ComposeWorkspaceFileMention[] = [];

  for (const value of Array.isArray(values) ? values : []) {
    if (!value) continue;
    if (value.type === "text") {
      const draft = buildComposeDraftFromStructuredText(value.text, value.text_elements, {
        inferAbsolutePaths: true,
        idPrefix: "queue-file",
      });
      composeParts.push(draft.composeInput);
      composeFileMentions.push(...draft.composeFileMentions);
      continue;
    }

    if ((value as any)?.type !== "mention") continue;
    const mention = createComposeFileMention(String((value as any)?.path ?? ""), { idPrefix: "queue-file" });
    if (!mention) continue;
    composeParts.push(COMPOSE_FILE_TOKEN_CHAR);
    composeFileMentions.push(mention);
  }

  return {
    composeInput: composeParts.join(""),
    composeFileMentions,
  };
}

export function buildUserTurnInputsFromComposeDraft(
  composeInputValue: string,
  mentionsValue: ComposeWorkspaceFileMention[]
): UserTurnInput[] {
  const textInput = buildTextUserInputFromComposeDraft(composeInputValue, mentionsValue);
  return textInput ? [textInput] : [];
}
