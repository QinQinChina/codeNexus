import type { DynamicToolCallOutputContentItem } from "../../generated/codex-app-server/v2/DynamicToolCallOutputContentItem";

export type DynamicToolTimelineStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "awaitingApproval"
  | "rejected";

export type DynamicToolTimelineItem = {
  callId: string;
  toolName: string;
  label: string;
  status: DynamicToolTimelineStatus;
  approvalRequired: boolean;
  argsRaw: string;
  argsSummary: string;
  resultSummary: string;
  errorText: string;
  contentItems: DynamicToolCallOutputContentItem[];
};

export function dynamicToolStatusText(status: DynamicToolTimelineStatus): string {
  if (status === "succeeded") return "已完成";
  if (status === "failed") return "失败";
  if (status === "cancelled") return "已取消";
  if (status === "awaitingApproval") return "等待审批";
  if (status === "rejected") return "已拒绝";
  return "运行中";
}
