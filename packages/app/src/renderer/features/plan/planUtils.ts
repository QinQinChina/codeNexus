// 计划摘要工具：处理 plan 的状态枚举、文本合并与展示友好化格式化。
export type PlanStepStatus = "pending" | "inProgress" | "completed";

// 兼容服务端不同拼写，把状态统一成前端内部枚举。
export function normalizePlanStepStatus(value: unknown): PlanStepStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "completed") return "completed";
  if (normalized === "inprogress" || normalized === "in_progress") return "inProgress";
  return "pending";
}
