import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync("src/renderer/components/ui/AgentMarkdownContent.vue", "utf8");

describe("AgentMarkdownContent syntax highlight integration", () => {
  it("enhances regular markdown code blocks with Shiki while leaving Mermaid blocks alone", () => {
    expect(componentSource).toContain("highlightCodeTokens");
    expect(componentSource).toContain("enhanceSyntaxHighlightedCodeBlocks");
    expect(componentSource).toContain('codeElement.classList.contains("language-mermaid")');
    expect(componentSource).toContain("dataset.agentSyntaxHighlighted");
  });

  it("uses the shared app scrollbar styling for markdown code blocks", () => {
    expect(componentSource).toContain('preElement.classList.add("app-scrollbar")');
  });
});
