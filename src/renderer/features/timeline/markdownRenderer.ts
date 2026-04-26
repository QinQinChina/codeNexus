import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

// Markdown 解析配置：禁用原生 HTML，仅保留常用 markdown 能力。
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

const originalLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options));

// 外链统一新窗口打开并加安全属性。
markdown.renderer.rules.link_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
  const token = tokens[idx];
  token.attrSet("target", "_blank");
  token.attrSet("rel", "noopener noreferrer nofollow");
  return originalLinkOpen(tokens, idx, options, env, self);
};

const originalTableOpen =
  markdown.renderer.rules.table_open ??
  ((tokens: any[], idx: number, options: any, env: any, self: any) => self.renderToken(tokens, idx, options, env));

const originalTableClose =
  markdown.renderer.rules.table_close ??
  ((tokens: any[], idx: number, options: any, env: any, self: any) => self.renderToken(tokens, idx, options, env));

// Markdown 表格默认容易挤压列宽：统一加一层横向滚动容器，避免把聊天气泡撑得很拥挤。
markdown.renderer.rules.table_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
  return `<div class="agent-table-scroll app-scrollbar">${originalTableOpen(tokens, idx, options, env, self)}`;
};

markdown.renderer.rules.table_close = (tokens: any[], idx: number, options: any, env: any, self: any) => {
  return `${originalTableClose(tokens, idx, options, env, self)}</div>`;
};

const sanitizeOptions = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onmouseenter",
    "onmouseleave",
    "style",
    "formaction",
    "xlink:href",
  ],
  ALLOW_DATA_ATTR: false,
};

const CACHE_MAX = 320;
const CACHE_KEEP = 260;
const htmlCache = new Map<string, string>();

// 控制缓存体积，超过阈值后清理最旧条目。
function pruneCacheIfNeeded() {
  if (htmlCache.size <= CACHE_MAX) return;
  const staleKeys = [...htmlCache.keys()].slice(0, Math.max(0, htmlCache.size - CACHE_KEEP));
  for (const key of staleKeys) htmlCache.delete(key);
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdown(text: string): string {
  try {
    return markdown.render(text);
  } catch {
    // markdown 解析器异常时降级为纯文本段落，避免渲染崩溃。
    return `<p>${escapeHtml(text)}</p>`;
  }
}

export function renderMarkdownToSafeHtml(text: string): string {
  const source = String(text ?? "");
  const cached = htmlCache.get(source);
  if (cached != null) return cached;
  // 渲染后再做 DOMPurify 清洗，防止脚本/危险属性注入。
  const rendered = renderMarkdown(source);
  const sanitized = String(DOMPurify.sanitize(rendered, sanitizeOptions));
  htmlCache.set(source, sanitized);
  pruneCacheIfNeeded();
  return sanitized;
}

export function getMarkdownHtmlCacheStats(): { items: number; bytes: number; updatedAt: number } {
  let bytes = 0;
  for (const [key, value] of htmlCache.entries()) {
    bytes += key.length;
    bytes += value.length;
  }
  return {
    items: htmlCache.size,
    bytes: Math.max(0, Math.round(bytes)),
    updatedAt: Date.now(),
  };
}

export function clearMarkdownHtmlCache(): void {
  htmlCache.clear();
}
