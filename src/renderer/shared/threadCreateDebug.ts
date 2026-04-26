type ThreadCreateAttemptRecord = {
  attemptId: string;
  startedAt: number;
  threadId?: string;
};

export const PENDING_THREAD_ID_PREFIX = "local-pending-thread:";
const MAX_THREAD_CREATE_ATTEMPTS = 50;
const attemptsById = new Map<string, ThreadCreateAttemptRecord>();
const attemptOrder: string[] = [];
const attemptIdByThreadId = new Map<string, string>();
let threadCreateAttemptSeq = 0;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function pruneThreadCreateAttempts() {
  while (attemptOrder.length > MAX_THREAD_CREATE_ATTEMPTS) {
    const oldestId = attemptOrder.shift();
    if (!oldestId) break;
    const record = attemptsById.get(oldestId);
    if (record?.threadId) {
      const mappedAttemptId = attemptIdByThreadId.get(record.threadId);
      if (mappedAttemptId === oldestId) attemptIdByThreadId.delete(record.threadId);
    }
    attemptsById.delete(oldestId);
  }
}

export function createPendingThreadId(): string {
  threadCreateAttemptSeq += 1;
  return `${PENDING_THREAD_ID_PREFIX}${Date.now().toString(36)}-${threadCreateAttemptSeq.toString(36)}`;
}

export function isPendingThreadId(threadIdValue: string): boolean {
  return normalizeText(threadIdValue).startsWith(PENDING_THREAD_ID_PREFIX);
}

export function beginThreadCreateAttempt(): string {
  threadCreateAttemptSeq += 1;
  const attemptId = `tc-${Date.now().toString(36)}-${threadCreateAttemptSeq.toString(36)}`;
  attemptsById.set(attemptId, {
    attemptId,
    startedAt: Date.now(),
  });
  attemptOrder.push(attemptId);
  pruneThreadCreateAttempts();
  return attemptId;
}

export function bindThreadCreateAttemptToThread(attemptIdValue: string, threadIdValue: string): void {
  const attemptId = normalizeText(attemptIdValue);
  const threadId = normalizeText(threadIdValue);
  if (!attemptId || !threadId) return;
  const record = attemptsById.get(attemptId);
  if (!record) return;
  record.threadId = threadId;
  attemptIdByThreadId.set(threadId, attemptId);
}

export function findThreadCreateAttemptIdByThreadId(threadIdValue: string): string {
  const threadId = normalizeText(threadIdValue);
  if (!threadId) return "";
  return normalizeText(attemptIdByThreadId.get(threadId));
}

export function findRecentPendingThreadCreateAttemptId(maxAgeMs = 30_000): string {
  const now = Date.now();
  const maxAge = Math.max(0, Math.round(Number(maxAgeMs) || 0));
  for (let i = attemptOrder.length - 1; i >= 0; i -= 1) {
    const attemptId = attemptOrder[i];
    const record = attemptsById.get(attemptId);
    if (!record) continue;
    if (record.threadId) continue;
    if (maxAge > 0 && now - record.startedAt > maxAge) continue;
    return attemptId;
  }
  return "";
}
