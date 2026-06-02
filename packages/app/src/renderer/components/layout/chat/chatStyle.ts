import type { ActivityTone } from "../types/chat.types";
import type { SandboxMode } from "../../../stores/runtime.store";

export function chatActivityToneClass(tone?: ActivityTone | string): string {
  if (tone === "running") return "is-running";
  if (tone === "ok") return "is-ok";
  if (tone === "error") return "is-error";
  if (tone === "warn") return "is-warn";
  return "";
}

export function chatSandboxToneClass(mode: SandboxMode | string): string {
  if (mode === "read-only") return "border-[var(--border-success)] bg-[var(--bg-success-soft)]";
  if (mode === "workspace-write") return "border-[var(--border-warning)] bg-[var(--bg-warning-soft)]";
  return "border-[var(--border-danger)] bg-[var(--bg-danger-soft)]";
}
