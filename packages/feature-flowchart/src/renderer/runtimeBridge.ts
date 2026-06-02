import {
  normalizeFlowchartAiSettings,
  type LocalFlowchartAiSettings,
} from "../settings";
import type {
  FlowchartAiRunArgs,
  FlowchartAiRunResult,
  FlowchartDocument,
  FlowchartHistoryDeleteResult,
  FlowchartHistoryListResult,
  FlowchartHistoryUpsertResult,
} from "../types";

type FlowchartToastKind = "info" | "success" | "warn" | "error";

type FlowchartDesktopApi = {
  app: {
    upsertFlowchartHistory(args: { document: FlowchartDocument }): Promise<FlowchartHistoryUpsertResult>;
    listFlowchartHistory(): Promise<FlowchartHistoryListResult>;
    deleteFlowchartHistory(args: { id: string }): Promise<FlowchartHistoryDeleteResult>;
    runFlowchartAi(args: FlowchartAiRunArgs): Promise<FlowchartAiRunResult>;
  };
  localState: {
    initialSettingsSnapshot?: {
      settings?: unknown;
    };
    readSettings(): Promise<{ settings?: unknown }>;
    patchSettings(args: { patch: { flowchartAi: LocalFlowchartAiSettings } }): Promise<{
      settings: unknown;
    }>;
  };
};

function getFlowchartDesktopApi(): FlowchartDesktopApi {
  const api = (window as unknown as { codexDesktop?: FlowchartDesktopApi }).codexDesktop;
  if (!api) throw new Error("codexDesktop bridge is not available.");
  return api;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractFlowchartAiSettings(value: unknown): LocalFlowchartAiSettings {
  return normalizeFlowchartAiSettings(toRecord(value)?.flowchartAi);
}

export function showFlowchartToast(options: { kind?: FlowchartToastKind; title?: string; message: string }): void {
  window.dispatchEvent(new CustomEvent("codenexus:toast", { detail: options }));
}

export function openFlowchartSettings(): void {
  window.dispatchEvent(new CustomEvent("codenexus:open-settings", { detail: { tab: "flowchart" } }));
}

export async function listFlowchartHistory(): Promise<FlowchartHistoryListResult> {
  return await getFlowchartDesktopApi().app.listFlowchartHistory();
}

export async function upsertFlowchartHistory(document: FlowchartDocument): Promise<FlowchartHistoryUpsertResult> {
  return await getFlowchartDesktopApi().app.upsertFlowchartHistory({ document });
}

export async function deleteFlowchartHistory(id: string): Promise<FlowchartHistoryDeleteResult> {
  return await getFlowchartDesktopApi().app.deleteFlowchartHistory({ id });
}

export async function runFlowchartAi(args: FlowchartAiRunArgs): Promise<FlowchartAiRunResult> {
  return await getFlowchartDesktopApi().app.runFlowchartAi(args);
}

export function getInitialFlowchartAiSettings(): LocalFlowchartAiSettings {
  const snapshot = (window as unknown as { codexDesktop?: FlowchartDesktopApi }).codexDesktop?.localState
    ?.initialSettingsSnapshot;
  return extractFlowchartAiSettings(snapshot?.settings);
}

export async function readFlowchartAiSettings(): Promise<LocalFlowchartAiSettings> {
  try {
    const res = await getFlowchartDesktopApi().localState.readSettings();
    return extractFlowchartAiSettings(res?.settings);
  } catch {
    return getInitialFlowchartAiSettings();
  }
}

export async function patchFlowchartAiSettings(settings: LocalFlowchartAiSettings): Promise<LocalFlowchartAiSettings> {
  const result = await getFlowchartDesktopApi().localState.patchSettings({ patch: { flowchartAi: settings } });
  return extractFlowchartAiSettings(result.settings);
}