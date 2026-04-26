import type { CompletedTurnState } from "./types";

export type HistoryRewriteRollbackResolution = {
  count: number;
  turnIds: string[];
  combinedDiff: string;
};

export function resolveHistoryRewriteRollback(
  completedTurns: readonly CompletedTurnState[],
  anchorTurnId: unknown
): HistoryRewriteRollbackResolution | null {
  const anchor = String(anchorTurnId ?? "").trim();
  if (!anchor) return null;

  const normalized = (completedTurns ?? [])
    .map((entry) => ({
      turnId: String(entry?.turnId ?? "").trim(),
      diffText: typeof entry?.diffText === "string" ? entry.diffText : "",
      completedAt: Number.isFinite(Number(entry?.completedAt)) ? Number(entry.completedAt) : 0,
    }))
    .filter((entry) => entry.turnId)
    .sort((a, b) => a.completedAt - b.completedAt);

  const anchorIndex = normalized.findIndex((entry) => entry.turnId === anchor);
  if (anchorIndex < 0) return null;

  const selected = normalized.slice(anchorIndex);
  const combinedDiff = [...selected]
    .reverse()
    .map((entry) => entry.diffText)
    .filter((text) => String(text ?? "").trim().length > 0)
    .join("\n\n");

  return {
    count: selected.length,
    turnIds: selected.map((entry) => entry.turnId),
    combinedDiff,
  };
}
