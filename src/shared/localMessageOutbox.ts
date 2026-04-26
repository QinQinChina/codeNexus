import type { TextElement } from "../generated/codex-app-server/v2/TextElement";

export type LocalTextUserInputElement = TextElement;

export type LocalTextUserInput = {
  type: "text";
  text: string;
  text_elements?: LocalTextUserInputElement[];
};

export type LocalImageUserInput = {
  type: "image";
  url: string;
};

export type LocalImagePathUserInput = {
  type: "localImage";
  path: string;
};

export type LocalUserTurnInput = LocalTextUserInput | LocalImageUserInput | LocalImagePathUserInput;

export type LocalOutboxQueuedMessage = {
  id: string;
  threadId: string;
  text: string;
  inputs: LocalUserTurnInput[];
  displayText?: string;
  createdAt: number;
  status: "queued";
  localEventId?: string;
};

export type LocalMessageOutbox = {
  version: 1;
  updatedAt: number;
  threads: Record<string, LocalOutboxQueuedMessage[]>;
};

export const DEFAULT_LOCAL_MESSAGE_OUTBOX: LocalMessageOutbox = {
  version: 1,
  updatedAt: 0,
  threads: {},
};

export const MAX_LOCAL_OUTBOX_ITEMS_PER_THREAD = 50;

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toThreadKey(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTextElement(value: unknown): LocalTextUserInputElement | null {
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

export function normalizeLocalUserTurnInput(value: unknown): LocalUserTurnInput | null {
  const record = toRecord(value);
  const type = String(record?.type ?? "").trim();
  if (type === "text") {
    const textElements = Array.isArray(record?.text_elements)
      ? record.text_elements
          .map((item) => normalizeTextElement(item))
          .filter((item): item is LocalTextUserInputElement => item != null)
      : [];
    return {
      type: "text",
      text: typeof record?.text === "string" ? record.text : "",
      ...(textElements.length > 0 ? { text_elements: textElements } : {}),
    };
  }
  if (type === "image") {
    return { type: "image", url: String(record?.url ?? "") };
  }
  if (type === "localImage") {
    return { type: "localImage", path: String(record?.path ?? "") };
  }
  if (type === "mention") {
    const path = String(record?.path ?? "").trim();
    if (!path) return null;
    return {
      type: "text",
      text: path,
      text_elements: [
        {
          byteRange: {
            start: 0,
            end: new TextEncoder().encode(path).length,
          },
          placeholder: String(record?.name ?? "").trim() || null,
        },
      ],
    };
  }
  return null;
}

export function cloneLocalUserTurnInput(value: LocalUserTurnInput): LocalUserTurnInput {
  if (value.type === "text") {
    return {
      type: "text",
      text: String(value.text ?? ""),
      ...(Array.isArray(value.text_elements)
        ? {
            text_elements: value.text_elements
              .map((item) => normalizeTextElement(item))
              .filter((item): item is LocalTextUserInputElement => item != null),
          }
        : {}),
    };
  }
  if (value.type === "image") {
    return { type: "image", url: String(value.url ?? "") };
  }
  if (value.type === "localImage") {
    return { type: "localImage", path: String(value.path ?? "") };
  }
  const exhaustive: never = value;
  return exhaustive;
}

export function cloneLocalUserTurnInputs(values: LocalUserTurnInput[]): LocalUserTurnInput[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  return values.map((value) => cloneLocalUserTurnInput(value));
}

export function normalizeLocalOutboxQueuedMessage(
  value: unknown,
  threadIdValue?: string
): LocalOutboxQueuedMessage | null {
  const record = toRecord(value);
  const id = String(record?.id ?? "").trim();
  const threadId = toThreadKey(threadIdValue ?? record?.threadId);
  if (!id || !threadId) return null;
  const items = Array.isArray(record?.inputs)
    ? record.inputs
        .map((item) => normalizeLocalUserTurnInput(item))
        .filter((item): item is LocalUserTurnInput => item != null)
    : [];
  const createdAtRaw = Number(record?.createdAt);
  return {
    id,
    threadId,
    text: typeof record?.text === "string" ? record.text : "",
    inputs: cloneLocalUserTurnInputs(items),
    ...(String(record?.displayText ?? "").trim() ? { displayText: String(record?.displayText ?? "").trim() } : {}),
    createdAt: Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now(),
    status: "queued",
    ...(String(record?.localEventId ?? "").trim() ? { localEventId: String(record?.localEventId ?? "").trim() } : {}),
  };
}

export function normalizeLocalMessageOutbox(value: unknown): LocalMessageOutbox {
  const root = toRecord(value);
  const threadsRecord = toRecord(root?.threads);
  const threads: Record<string, LocalOutboxQueuedMessage[]> = {};
  for (const [rawThreadId, rawItems] of Object.entries(threadsRecord ?? {})) {
    const threadId = toThreadKey(rawThreadId);
    if (!threadId || !Array.isArray(rawItems)) continue;
    const items = rawItems
      .map((item) => normalizeLocalOutboxQueuedMessage(item, threadId))
      .filter((item): item is LocalOutboxQueuedMessage => item != null)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_LOCAL_OUTBOX_ITEMS_PER_THREAD);
    if (items.length > 0) threads[threadId] = items;
  }
  const updatedAt = Number(root?.updatedAt);
  return {
    version: 1,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    threads,
  };
}

export function replaceLocalMessageOutboxThread(
  current: unknown,
  threadIdValue: string,
  itemsValue: unknown
): LocalMessageOutbox {
  const next = normalizeLocalMessageOutbox(current);
  const threadId = toThreadKey(threadIdValue);
  if (!threadId) return next;
  const items = Array.isArray(itemsValue)
    ? itemsValue
        .map((item) => normalizeLocalOutboxQueuedMessage(item, threadId))
        .filter((item): item is LocalOutboxQueuedMessage => item != null)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-MAX_LOCAL_OUTBOX_ITEMS_PER_THREAD)
    : [];
  const threads = { ...next.threads };
  if (items.length > 0) threads[threadId] = items;
  else delete threads[threadId];
  return {
    version: 1,
    updatedAt: Date.now(),
    threads,
  };
}

export function removeLocalMessageOutboxThread(current: unknown, threadIdValue: string): LocalMessageOutbox {
  const next = normalizeLocalMessageOutbox(current);
  const threadId = toThreadKey(threadIdValue);
  if (!threadId || !(threadId in next.threads)) return next;
  const threads = { ...next.threads };
  delete threads[threadId];
  return {
    version: 1,
    updatedAt: Date.now(),
    threads,
  };
}
