import type { ToastOptions } from "../../ui/toast";

type ProtocolNoticeMethod = "warning" | "guardianWarning" | "model/verification";

type ProtocolNoticeInput = {
  method: ProtocolNoticeMethod;
  params: unknown;
};

const CODEX_WARNING_TITLE = "Codex \u8b66\u544a";
const GUARDIAN_WARNING_TITLE = "Guardian \u8b66\u544a";
const MODEL_VERIFICATION_TITLE = "\u6a21\u578b\u9a8c\u8bc1";
const NOTICE_SEPARATOR = "\uFF1A";
const MODEL_VERIFICATION_UPDATED = "\u6a21\u578b\u9a8c\u8bc1\u72b6\u6001\u5df2\u66f4\u65b0";

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toMessage(value: unknown, fallback: string): string {
  const message = String(value == null ? "" : value).trim();
  return message || fallback;
}

function summarizeModelVerifications(value: unknown): string {
  if (!Array.isArray(value)) return MODEL_VERIFICATION_UPDATED;
  const names = value.map((item) => String(item == null ? "" : item).trim()).filter(Boolean);
  return names.length > 0 ? names.join(", ") : MODEL_VERIFICATION_UPDATED;
}

export function buildProtocolNoticeTimelineText(method: ProtocolNoticeMethod, paramsValue: unknown): string {
  const params = toRecord(paramsValue);
  if (method === "warning") {
    return `${CODEX_WARNING_TITLE}${NOTICE_SEPARATOR}${toMessage(params.message, "\u6536\u5230 Codex \u8b66\u544a")}`;
  }
  if (method === "guardianWarning") {
    return `${GUARDIAN_WARNING_TITLE}${NOTICE_SEPARATOR}${toMessage(params.message, "\u6536\u5230 Guardian \u8b66\u544a")}`;
  }
  return `${MODEL_VERIFICATION_TITLE}${NOTICE_SEPARATOR}${summarizeModelVerifications(params.verifications)}`;
}

export function buildProtocolNoticeToast(input: ProtocolNoticeInput): ToastOptions {
  const params = toRecord(input.params);
  if (input.method === "warning") {
    return {
      kind: "warn",
      title: CODEX_WARNING_TITLE,
      message: toMessage(params.message, "\u6536\u5230 Codex \u8b66\u544a"),
      timeoutMs: 7000,
    };
  }
  if (input.method === "guardianWarning") {
    return {
      kind: "warn",
      title: GUARDIAN_WARNING_TITLE,
      message: toMessage(params.message, "\u6536\u5230 Guardian \u8b66\u544a"),
      timeoutMs: 9000,
    };
  }
  return { kind: "info", title: MODEL_VERIFICATION_TITLE, message: summarizeModelVerifications(params.verifications), timeoutMs: 5000 };
}
