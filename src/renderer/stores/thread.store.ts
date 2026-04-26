import { defineStore } from "pinia";
import type {
  CompletedTurnState,
  ThreadHandoffDiagnosticsState,
  PlanStepState,
  ThreadHistoryItem,
  TokenUsageState,
  TurnPlanState,
} from "../domain/types";
import { normalizeThreadTitleOverride, resolveDisplayThreadTitleWithOverride } from "../features/history/threadTitle";

const COMPLETED_BADGE_DURATION_MS = 10_000;
const completedBadgeTimersByThread = new Map<string, ReturnType<typeof setTimeout>>();
const TURN_STARTED_AT_CACHE_LIMIT = 120;
const TURN_PLAN_CACHE_LIMIT = 120;

function toFiniteNonNegativeNumberOrNull(value: unknown): number | null {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, raw);
}

function normalizeTokenUsage(value: unknown): TokenUsageState {
  const anyValue = value && typeof value === "object" ? (value as any) : null;
  const lastUsage = anyValue?.last && typeof anyValue.last === "object" ? anyValue.last : null;
  const totalUsage = anyValue?.total && typeof anyValue.total === "object" ? anyValue.total : null;
  return {
    usedTokens: toFiniteNonNegativeNumberOrNull(
      anyValue?.usedTokens ?? lastUsage?.totalTokens ?? lastUsage?.inputTokens ?? totalUsage?.totalTokens
    ),
    contextWindow: toFiniteNonNegativeNumberOrNull(anyValue?.contextWindow ?? anyValue?.modelContextWindow),
  };
}

function addToSet(set: Set<string>, key: string): Set<string> {
  if (!key) return set;
  const next = new Set(set);
  next.add(key);
  return next;
}

function removeFromSet(set: Set<string>, key: string): Set<string> {
  if (!key) return set;
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}

function renameInSet(set: Set<string>, fromKey: string, toKey: string): Set<string> {
  if (!fromKey || !toKey || fromKey === toKey) return set;
  if (!set.has(fromKey)) return set;
  const next = new Set(set);
  next.delete(fromKey);
  next.add(toKey);
  return next;
}

function normalizeThreadId(value: unknown): string {
  return String(value ?? "").trim();
}

export const useThreadStore = defineStore("thread", {
  state: () => ({
    currentWorkspace: "" as string,
    currentThreadId: "" as string,
    loadingThreadId: "" as string,
    threadHistory: [] as ThreadHistoryItem[],
    runningThreadIds: new Set<string>(),
    attentionThreadIds: new Set<string>(),
    recentlyCompletedThreadIds: new Set<string>(),
    threadTitleOverridesByThreadId: new Map<string, string>(),
    tokenUsageByThread: new Map<string, TokenUsageState>(),
    activeTurnIdByThread: new Map<string, string>(),
    turnStartedAtByThread: new Map<string, Map<string, number>>(),
    handoffDiagnosticsByThread: new Map<string, ThreadHandoffDiagnosticsState>(),
    handoffDiagnosticsLoadingThreadIds: new Set<string>(),
    turnDiffByThread: new Map<string, Map<string, string>>(),
    completedTurnsByThread: new Map<string, CompletedTurnState[]>(),
    latestTurnPlanByThread: new Map<string, TurnPlanState>(),
    turnPlansByThread: new Map<string, Map<string, TurnPlanState>>(),
  }),
  getters: {
    // 当前线程 token 使用量（无线程时返回空值占位）。
    currentTokenUsage(state): TokenUsageState {
      const key = state.currentThreadId;
      if (!key) return { usedTokens: null, contextWindow: null };
      return state.tokenUsageByThread.get(key) ?? { usedTokens: null, contextWindow: null };
    },
    currentCompletedTurns(state): CompletedTurnState[] {
      const key = state.currentThreadId;
      if (!key) return [];
      return state.completedTurnsByThread.get(key) ?? [];
    },
    currentTurnPlan(state): TurnPlanState | null {
      const key = state.currentThreadId;
      if (!key) return null;
      return state.latestTurnPlanByThread.get(key) ?? null;
    },
    turnPlanForTurn: (state) => {
      return (threadIdValue: string, turnIdValue: string): TurnPlanState | null => {
        const threadId = String(threadIdValue ?? "").trim();
        const turnId = String(turnIdValue ?? "").trim();
        if (!threadId || !turnId) return null;
        return state.turnPlansByThread.get(threadId)?.get(turnId) ?? null;
      };
    },
    displayThreadTitle: (state) => {
      return (threadIdValue: string, incomingTitle?: unknown): string => {
        const threadId = normalizeThreadId(threadIdValue);
        const override = threadId ? state.threadTitleOverridesByThreadId.get(threadId) : "";
        return resolveDisplayThreadTitleWithOverride(threadId, incomingTitle, override ?? "");
      };
    },
  },
  actions: {
    setWorkspace(path: string) {
      this.currentWorkspace = path;
    },
    setCurrentThread(threadId: string) {
      const tid = String(threadId ?? "").trim();
      this.currentThreadId = tid;
      if (tid) this.attentionThreadIds = removeFromSet(this.attentionThreadIds, tid);
    },
    setLoadingThread(threadId: string) {
      this.loadingThreadId = String(threadId ?? "").trim();
    },
    clearLoadingThread(threadId?: string) {
      const target = String(threadId ?? "").trim();
      if (!target) {
        this.loadingThreadId = "";
        return;
      }
      if (this.loadingThreadId === target) this.loadingThreadId = "";
    },
    // 历史会话 upsert，并按更新时间倒序。
    upsertThreadHistory(item: ThreadHistoryItem) {
      const idx = this.threadHistory.findIndex((x) => x.id === item.id);
      if (idx >= 0) this.threadHistory[idx] = item;
      else this.threadHistory.push(item);
      this.threadHistory.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    applyThreadTitleOverrides(overrides: Record<string, string> | null | undefined) {
      const next = new Map<string, string>();
      if (overrides && typeof overrides === "object") {
        for (const [rawThreadId, rawTitle] of Object.entries(overrides)) {
          const threadId = normalizeThreadId(rawThreadId);
          if (!threadId) continue;
          const title = normalizeThreadTitleOverride(rawTitle);
          if (!title) continue;
          next.set(threadId, title);
        }
      }
      this.threadTitleOverridesByThreadId = next;
    },
    setThreadTitleOverride(threadIdValue: string, titleValue: string) {
      const threadId = normalizeThreadId(threadIdValue);
      if (!threadId) return;
      const title = normalizeThreadTitleOverride(titleValue);
      if (!title) {
        this.threadTitleOverridesByThreadId.delete(threadId);
        return;
      }
      this.threadTitleOverridesByThreadId.set(threadId, title);
    },
    clearThreadTitleOverride(threadIdValue: string) {
      const threadId = normalizeThreadId(threadIdValue);
      if (!threadId) return;
      this.threadTitleOverridesByThreadId.delete(threadId);
    },
    replaceThreadId(fromThreadIdValue: string, toThreadIdValue: string, patch?: Partial<ThreadHistoryItem>) {
      const fromId = normalizeThreadId(fromThreadIdValue);
      const toId = normalizeThreadId(toThreadIdValue);
      if (!fromId || !toId || fromId === toId) return;

      if (this.currentThreadId === fromId) this.currentThreadId = toId;
      if (this.loadingThreadId === fromId) this.loadingThreadId = toId;

      const fromHistory = this.threadHistory.find((item) => item.id === fromId);
      const toHistory = this.threadHistory.find((item) => item.id === toId);
      this.threadHistory = this.threadHistory.filter((item) => item.id !== fromId && item.id !== toId);
      const mergedHistory = {
        ...(fromHistory ?? {}),
        ...(toHistory ?? {}),
        ...(patch ?? {}),
        id: toId,
      } as ThreadHistoryItem;
      if (mergedHistory.id) this.threadHistory.push(mergedHistory);
      this.threadHistory.sort((a, b) => b.updatedAt - a.updatedAt);

      this.attentionThreadIds = renameInSet(this.attentionThreadIds, fromId, toId);
      this.recentlyCompletedThreadIds = renameInSet(this.recentlyCompletedThreadIds, fromId, toId);
      if (this.runningThreadIds.has(fromId)) {
        this.runningThreadIds.delete(fromId);
        this.runningThreadIds.add(toId);
      }

      const moveMapEntry = <T>(map: Map<string, T>, merge?: (fromValue: T, toValue: T) => T) => {
        const fromValue = map.get(fromId);
        if (fromValue === undefined) return;
        const toValue = map.get(toId);
        map.delete(fromId);
        map.set(toId, toValue !== undefined && merge ? merge(fromValue, toValue) : (toValue ?? fromValue));
      };

      moveMapEntry(this.tokenUsageByThread);
      moveMapEntry(this.activeTurnIdByThread);
      moveMapEntry(this.turnStartedAtByThread, (fromValue, toValue) => new Map([...toValue.entries(), ...fromValue.entries()]));
      moveMapEntry(
        this.turnDiffByThread,
        (fromValue, toValue) => new Map([...toValue.entries(), ...fromValue.entries()])
      );
      moveMapEntry(this.completedTurnsByThread, (fromValue, toValue) => {
        const merged = [...toValue, ...fromValue];
        merged.sort((a, b) => a.completedAt - b.completedAt);
        return merged.slice(Math.max(0, merged.length - 60));
      });
      moveMapEntry(this.handoffDiagnosticsByThread);
      moveMapEntry(this.latestTurnPlanByThread);
      moveMapEntry(
        this.turnPlansByThread,
        (fromValue, toValue) => new Map<string, TurnPlanState>([...toValue.entries(), ...fromValue.entries()])
      );
      this.handoffDiagnosticsLoadingThreadIds = renameInSet(this.handoffDiagnosticsLoadingThreadIds, fromId, toId);
      if (this.threadTitleOverridesByThreadId.has(fromId)) {
        const value = this.threadTitleOverridesByThreadId.get(fromId) ?? "";
        this.threadTitleOverridesByThreadId.delete(fromId);
        if (value) this.threadTitleOverridesByThreadId.set(toId, value);
      }

      const timer = completedBadgeTimersByThread.get(fromId);
      if (timer) {
        completedBadgeTimersByThread.delete(fromId);
        completedBadgeTimersByThread.set(toId, timer);
      }
    },
    // 标记线程是否运行中（用于 UI 禁用与状态徽标）。
    setThreadRunning(threadId: string, running: boolean) {
      if (!threadId) return;
      if (running) this.runningThreadIds.add(threadId);
      else this.runningThreadIds.delete(threadId);
    },
    // 标记线程需要提醒（用于列表闹铃图标）。
    setThreadAttention(threadId: string, attention: boolean) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      this.attentionThreadIds = attention
        ? addToSet(this.attentionThreadIds, tid)
        : removeFromSet(this.attentionThreadIds, tid);
    },
    clearThreadAttention(threadId: string) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      this.attentionThreadIds = removeFromSet(this.attentionThreadIds, tid);
    },
    // 线程完成徽标：短暂展示“已完成”图标，便于扫视状态。
    showThreadCompletedBadge(threadId: string, durationMs: number = COMPLETED_BADGE_DURATION_MS) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      this.recentlyCompletedThreadIds.add(tid);
      const prev = completedBadgeTimersByThread.get(tid);
      if (prev) {
        try {
          clearTimeout(prev);
        } catch {}
        completedBadgeTimersByThread.delete(tid);
      }
      const ms = Math.max(0, Math.round(Number(durationMs) || COMPLETED_BADGE_DURATION_MS));
      if (ms <= 0) return;
      const timer = setTimeout(() => {
        completedBadgeTimersByThread.delete(tid);
        this.recentlyCompletedThreadIds.delete(tid);
      }, ms);
      completedBadgeTimersByThread.set(tid, timer);
    },
    setActiveTurn(threadId: string, turnId: string) {
      if (!threadId) return;
      if (!turnId) {
        this.activeTurnIdByThread.delete(threadId);
        return;
      }
      this.activeTurnIdByThread.set(threadId, turnId);
    },
    setTurnStartedAt(threadId: string, turnId: string, startedAtMs: number) {
      const tid = String(threadId ?? "").trim();
      const turn = String(turnId ?? "").trim();
      const startedAt = Number.isFinite(startedAtMs) ? Math.max(0, Math.round(startedAtMs)) : 0;
      if (!tid || !turn || startedAt <= 0) return;

      const map = this.turnStartedAtByThread.get(tid) ?? new Map<string, number>();
      if (!this.turnStartedAtByThread.has(tid)) {
        this.turnStartedAtByThread.set(tid, map);
      }
      map.set(turn, startedAt);

      if (map.size > TURN_STARTED_AT_CACHE_LIMIT) {
        const overflow = map.size - TURN_STARTED_AT_CACHE_LIMIT;
        let removed = 0;
        for (const key of map.keys()) {
          map.delete(key);
          removed += 1;
          if (removed >= overflow) break;
        }
      }
    },
    setTokenUsage(threadId: string, usage: TokenUsageState) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      const normalized = normalizeTokenUsage(usage);
      this.tokenUsageByThread.set(tid, normalized);
    },
    setThreadHandoffDiagnosticsLoading(threadId: string, loading: boolean) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      this.handoffDiagnosticsLoadingThreadIds = loading
        ? addToSet(this.handoffDiagnosticsLoadingThreadIds, tid)
        : removeFromSet(this.handoffDiagnosticsLoadingThreadIds, tid);
    },
    setThreadHandoffDiagnostics(threadId: string, diagnostics: ThreadHandoffDiagnosticsState | null) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      if (!diagnostics) {
        this.handoffDiagnosticsByThread.delete(tid);
        return;
      }
      this.handoffDiagnosticsByThread.set(tid, diagnostics);
    },
    clearThreadHandoffDiagnostics(threadId: string) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      this.handoffDiagnosticsByThread.delete(tid);
      this.handoffDiagnosticsLoadingThreadIds = removeFromSet(this.handoffDiagnosticsLoadingThreadIds, tid);
    },
    setTurnDiff(threadId: string, turnId: string, diffText: string) {
      if (!threadId || !turnId) return;
      const map = this.turnDiffByThread.get(threadId) ?? new Map<string, string>();
      map.set(turnId, diffText);
      this.turnDiffByThread.set(threadId, map);
      const stack = this.completedTurnsByThread.get(threadId);
      if (!stack || stack.length === 0) return;
      const existingIndex = stack.findIndex((entry) => entry.turnId === turnId);
      if (existingIndex < 0) return;
      stack[existingIndex] = {
        ...stack[existingIndex],
        diffText,
      };
      this.completedTurnsByThread.set(threadId, stack);
    },
    // 记录已完成 turn，并带上该 turn 的 diff 快照用于回滚。
    markTurnCompleted(threadId: string, turnId: string) {
      if (!threadId || !turnId) return;
      const diffText = this.turnDiffByThread.get(threadId)?.get(turnId) ?? "";
      const stack = this.completedTurnsByThread.get(threadId) ?? [];
      const existingIndex = stack.findIndex((entry) => entry.turnId === turnId);
      if (existingIndex >= 0) {
        stack[existingIndex] = { turnId, diffText, completedAt: Date.now() };
      } else {
        stack.push({ turnId, diffText, completedAt: Date.now() });
      }
      if (stack.length > 60) stack.splice(0, stack.length - 60);
      this.completedTurnsByThread.set(threadId, stack);
      this.showThreadCompletedBadge(threadId);
      if (threadId !== this.currentThreadId) {
        this.attentionThreadIds = addToSet(this.attentionThreadIds, threadId);
      }
    },
    // 移除最近 N 个完成 turn（撤回入口使用）。
    removeLatestCompletedTurns(threadId: string, count: number): CompletedTurnState[] {
      if (!threadId || !Number.isFinite(count) || count <= 0) return [];
      const stack = this.completedTurnsByThread.get(threadId) ?? [];
      if (stack.length === 0) return [];
      const n = Math.min(stack.length, Math.max(1, Math.round(count)));
      const removed = stack.splice(stack.length - n, n);
      this.completedTurnsByThread.set(threadId, stack);
      return removed;
    },
    // 按 turnId 批量清理状态（完成栈、diff、plan、plan delta）。
    replaceRollbackState(threadId: string, completedTurns: CompletedTurnState[]) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      const normalized: CompletedTurnState[] = [];
      const indexByTurnId = new Map<string, number>();
      for (const entry of completedTurns ?? []) {
        const turnId = String(entry?.turnId ?? "").trim();
        if (!turnId) continue;
        const diffText = typeof entry?.diffText === "string" ? entry.diffText : "";
        const completedAtRaw = Number(entry?.completedAt);
        const completedAt = Number.isFinite(completedAtRaw) ? completedAtRaw : 0;
        const existingIndex = indexByTurnId.get(turnId);
        if (existingIndex == null) {
          indexByTurnId.set(turnId, normalized.length);
          normalized.push({ turnId, diffText, completedAt });
        } else {
          normalized[existingIndex] = { turnId, diffText, completedAt };
        }
      }
      normalized.sort((a, b) => a.completedAt - b.completedAt);
      if (normalized.length > 60) normalized.splice(0, normalized.length - 60);
      const finalDiffMap = new Map<string, string>();
      for (const entry of normalized) finalDiffMap.set(entry.turnId, entry.diffText);
      this.completedTurnsByThread.set(tid, normalized);
      if (normalized.length > 0 || finalDiffMap.size > 0) this.turnDiffByThread.set(tid, finalDiffMap);
      else this.turnDiffByThread.delete(tid);
    },
    removeTurnsFromState(threadId: string, turnIds: string[]) {
      if (!threadId || !Array.isArray(turnIds) || turnIds.length === 0) return;
      const idSet = new Set(turnIds.filter(Boolean));
      if (idSet.size === 0) return;
      const stack = this.completedTurnsByThread.get(threadId) ?? [];
      this.completedTurnsByThread.set(
        threadId,
        stack.filter((entry) => !idSet.has(entry.turnId))
      );
      const startedAtMap = this.turnStartedAtByThread.get(threadId);
      if (startedAtMap) {
        for (const turnId of idSet) {
          startedAtMap.delete(turnId);
        }
        if (startedAtMap.size === 0) this.turnStartedAtByThread.delete(threadId);
      }
      const diffMap = this.turnDiffByThread.get(threadId);
      if (diffMap) {
        for (const turnId of idSet) {
          diffMap.delete(turnId);
        }
      }
      const plan = this.latestTurnPlanByThread.get(threadId);
      if (plan && idSet.has(plan.turnId)) {
        this.latestTurnPlanByThread.delete(threadId);
      }
      const planMap = this.turnPlansByThread.get(threadId);
      if (planMap) {
        for (const turnId of idSet) {
          planMap.delete(turnId);
        }
        if (planMap.size === 0) this.turnPlansByThread.delete(threadId);
      }
    },
    // 更新当前 turn 的计划摘要；切换 turn 时重置旧 delta。
    setTurnPlan(threadId: string, turnId: string, explanation: string | null, plan: PlanStepState[]) {
      if (!threadId || !turnId) return;
      const entry: TurnPlanState = {
        threadId,
        turnId,
        explanation,
        plan: [...plan],
        updatedAt: Date.now(),
      };
      this.latestTurnPlanByThread.set(threadId, entry);

      const map = this.turnPlansByThread.get(threadId) ?? new Map<string, TurnPlanState>();
      if (!this.turnPlansByThread.has(threadId)) this.turnPlansByThread.set(threadId, map);
      // 用 delete + set 刷新插入顺序，便于按“最近更新”裁剪缓存。
      if (map.has(turnId)) map.delete(turnId);
      map.set(turnId, entry);
      if (map.size > TURN_PLAN_CACHE_LIMIT) {
        const overflow = map.size - TURN_PLAN_CACHE_LIMIT;
        let removed = 0;
        for (const key of map.keys()) {
          map.delete(key);
          removed += 1;
          if (removed >= overflow) break;
        }
      }
    },
    // 清理线程运行态缓存（删会话或切换工作区时使用）。
    clearThreadState(threadId: string) {
      const tid = String(threadId ?? "").trim();
      if (!tid) return;
      if (this.loadingThreadId === tid) this.loadingThreadId = "";
      this.runningThreadIds.delete(tid);
      this.attentionThreadIds = removeFromSet(this.attentionThreadIds, tid);
      this.recentlyCompletedThreadIds.delete(tid);
      const timer = completedBadgeTimersByThread.get(tid);
      if (timer) {
        try {
          clearTimeout(timer);
        } catch {}
        completedBadgeTimersByThread.delete(tid);
      }

      this.tokenUsageByThread.delete(tid);
      this.activeTurnIdByThread.delete(tid);
      this.turnStartedAtByThread.delete(tid);
      this.handoffDiagnosticsByThread.delete(tid);
      this.handoffDiagnosticsLoadingThreadIds = removeFromSet(this.handoffDiagnosticsLoadingThreadIds, tid);
      this.turnDiffByThread.delete(tid);
      this.completedTurnsByThread.delete(tid);
      this.latestTurnPlanByThread.delete(tid);
      this.turnPlansByThread.delete(tid);
    },
  },
});
