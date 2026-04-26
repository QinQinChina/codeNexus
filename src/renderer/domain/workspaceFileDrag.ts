import { normalizeAbsoluteFsPath } from "./workspacePath";

export const WORKSPACE_FILE_DRAG_MIME = "application/x-through-workspace-file";

export type DraggedWorkspaceFile = {
  path: string;
};

function normalizeDraggedWorkspaceFile(value: unknown): DraggedWorkspaceFile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const path = normalizeAbsoluteFsPath(String(record.path ?? ""));
  if (!path) return null;
  return {
    path,
  };
}

export function buildDraggedWorkspaceFile(pathValue: string): DraggedWorkspaceFile | null {
  const path = normalizeAbsoluteFsPath(pathValue);
  if (!path) return null;
  return {
    path,
  };
}

export function writeWorkspaceFileDragData(
  dataTransfer: DataTransfer | null,
  pathValue: string
): DraggedWorkspaceFile | null {
  const payload = buildDraggedWorkspaceFile(pathValue);
  if (!payload || !dataTransfer) return payload;
  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(WORKSPACE_FILE_DRAG_MIME, payload.path);
  dataTransfer.setData("text/plain", payload.path);
  return payload;
}

export function readWorkspaceFileDragData(dataTransfer: DataTransfer | null): DraggedWorkspaceFile[] {
  if (!dataTransfer) return [];

  const fromCustom = (() => {
    const raw = String(dataTransfer.getData(WORKSPACE_FILE_DRAG_MIME) ?? "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values
        .map((value) => normalizeDraggedWorkspaceFile(value))
        .filter((value): value is DraggedWorkspaceFile => Boolean(value));
    } catch {
      const path = normalizeAbsoluteFsPath(raw);
      if (!path) return [];
      return [{ path }];
    }
  })();

  if (fromCustom.length > 0) return fromCustom;

  const fallbackPath = normalizeAbsoluteFsPath(String(dataTransfer.getData("text/plain") ?? ""));
  if (!fallbackPath) return [];
  return [{ path: fallbackPath }];
}

export function hasWorkspaceFileDragData(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types ?? []);
  if (types.includes(WORKSPACE_FILE_DRAG_MIME)) return true;
  const textValue = normalizeAbsoluteFsPath(String(dataTransfer.getData("text/plain") ?? ""));
  return Boolean(textValue);
}
