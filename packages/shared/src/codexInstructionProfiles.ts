import type { MainView } from "./localSettings";
import {
  IMAGE_GENERATION_DYNAMIC_TOOL_DEVELOPER_INSTRUCTIONS,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
  type BuiltinDynamicToolName,
} from "./dynamicTools";

/**
 * 把主界面场景映射成 Codex app-server 可理解的 instruction profile。
 *
 * 这些 profile 是 shared 层和功能包之间的窄接口，避免调用侧直接拼接各工作台的提示词细节。
 */
export type CodexInstructionProfile =
  | "chat"
  | "flowchart"
  | "paper-outline"
  | "paper-draft"
  | "paper-revise"
  | "paper-citations";

/** 发送给模型的开发者指令保留英文，避免运行时提示词在中英之间产生语义偏移。 */
export const FLOWCHART_DEVELOPER_INSTRUCTIONS = [
  "You are operating inside a flowchart workbench.",
  "Focus on clear process structure, concise node labels, readable grouping, and valid diagram semantics.",
  "When asked to modify an existing flowchart, preserve user content and describe risky structural changes before applying them.",
].join("\n");

/** 论文工作台共享同一套安全边界，不同模式只追加当前阶段的输出约束。 */
const PAPER_BASE_DEVELOPER_INSTRUCTIONS = [
  "You are operating inside a paper writing workbench.",
  "Keep the workflow reviewable: preserve assumptions, evidence gaps, and required human confirmation points.",
  "Do not fabricate citations, datasets, experiment results, or publication details.",
  "Mark unsupported claims clearly instead of presenting them as verified facts.",
].join("\n");

export const PAPER_OUTLINE_DEVELOPER_INSTRUCTIONS = [
  PAPER_BASE_DEVELOPER_INSTRUCTIONS,
  "Current paper mode: outline. Produce or revise section structure, research scope, and chapter-level writing goals.",
  "Do not draft full manuscript sections unless the user explicitly asks for draft text.",
].join("\n");

export const PAPER_DRAFT_DEVELOPER_INSTRUCTIONS = [
  PAPER_BASE_DEVELOPER_INSTRUCTIONS,
  "Current paper mode: draft. Generate only the requested section or passage and keep citation gaps visible.",
  "Separate draft text from notes, assumptions, and follow-up verification tasks.",
].join("\n");

export const PAPER_REVISE_DEVELOPER_INSTRUCTIONS = [
  PAPER_BASE_DEVELOPER_INSTRUCTIONS,
  "Current paper mode: revise. Improve structure, clarity, academic tone, and consistency without inventing new evidence.",
  "Preserve the user's core claims unless the user requests a substantive rewrite.",
].join("\n");

export const PAPER_CITATIONS_DEVELOPER_INSTRUCTIONS = [
  PAPER_BASE_DEVELOPER_INSTRUCTIONS,
  "Current paper mode: citations. Focus on source verification, citation placement, and evidence gaps.",
  "Never create plausible-looking references. Use explicit unknown or citation-needed markers when sources are missing.",
].join("\n");

/** 论文模式未知时默认进入 draft，保证新旧状态迁移后仍能进入可写作模式。 */
export function codexInstructionProfileForPaperMode(
  mode: unknown,
): CodexInstructionProfile {
  if (mode === "outline") return "paper-outline";
  if (mode === "revise") return "paper-revise";
  if (mode === "citations") return "paper-citations";
  return "paper-draft";
}

/** 主视图决定基础 profile，论文工作台再由子模式细分。 */
export function codexInstructionProfileForMainView(
  mainView: MainView,
  paperMode?: unknown,
): CodexInstructionProfile {
  if (mainView === "flowchart") return "flowchart";
  if (mainView === "paper")
    return codexInstructionProfileForPaperMode(paperMode);
  return "chat";
}

/** 根据 profile 输出最终注入 Codex 会话的 developer instructions。 */
export function buildDeveloperInstructionsForProfile(
  profile: CodexInstructionProfile | null | undefined,
): string | null {
  if (profile === "chat")
    return IMAGE_GENERATION_DYNAMIC_TOOL_DEVELOPER_INSTRUCTIONS;
  if (profile === "flowchart") return FLOWCHART_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-outline") return PAPER_OUTLINE_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-revise") return PAPER_REVISE_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-citations")
    return PAPER_CITATIONS_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-draft") return PAPER_DRAFT_DEVELOPER_INSTRUCTIONS;
  return null;
}

/** chat profile 才默认注入图片生成工具，其他工作台先保持能力边界更窄。 */
export function buildDynamicToolNamesForInstructionProfile(
  profile: CodexInstructionProfile | null | undefined,
): BuiltinDynamicToolName[] {
  if (profile === "chat") return [IMAGE_GENERATION_DYNAMIC_TOOL_NAME];
  return [];
}
