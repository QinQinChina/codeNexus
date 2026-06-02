import type { MainView } from "./localSettings";
import {
  IMAGE_GENERATION_DYNAMIC_TOOL_DEVELOPER_INSTRUCTIONS,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
  type BuiltinDynamicToolName,
} from "./dynamicTools";

export type CodexInstructionProfile =
  | "chat"
  | "flowchart"
  | "paper-outline"
  | "paper-draft"
  | "paper-revise"
  | "paper-citations";

export const FLOWCHART_DEVELOPER_INSTRUCTIONS = [
  "You are operating inside a flowchart workbench.",
  "Focus on clear process structure, concise node labels, readable grouping, and valid diagram semantics.",
  "When asked to modify an existing flowchart, preserve user content and describe risky structural changes before applying them.",
].join("\n");

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

export function codexInstructionProfileForPaperMode(mode: unknown): CodexInstructionProfile {
  if (mode === "outline") return "paper-outline";
  if (mode === "revise") return "paper-revise";
  if (mode === "citations") return "paper-citations";
  return "paper-draft";
}

export function codexInstructionProfileForMainView(
  mainView: MainView,
  paperMode?: unknown
): CodexInstructionProfile {
  if (mainView === "flowchart") return "flowchart";
  if (mainView === "paper") return codexInstructionProfileForPaperMode(paperMode);
  return "chat";
}

export function buildDeveloperInstructionsForProfile(profile: CodexInstructionProfile | null | undefined): string | null {
  if (profile === "chat") return IMAGE_GENERATION_DYNAMIC_TOOL_DEVELOPER_INSTRUCTIONS;
  if (profile === "flowchart") return FLOWCHART_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-outline") return PAPER_OUTLINE_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-revise") return PAPER_REVISE_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-citations") return PAPER_CITATIONS_DEVELOPER_INSTRUCTIONS;
  if (profile === "paper-draft") return PAPER_DRAFT_DEVELOPER_INSTRUCTIONS;
  return null;
}

export function buildDynamicToolNamesForInstructionProfile(
  profile: CodexInstructionProfile | null | undefined
): BuiltinDynamicToolName[] {
  if (profile === "chat") return [IMAGE_GENERATION_DYNAMIC_TOOL_NAME];
  return [];
}
