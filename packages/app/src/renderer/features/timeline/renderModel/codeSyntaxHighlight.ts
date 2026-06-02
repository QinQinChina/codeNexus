import type { BundledLanguage, BundledTheme, Highlighter, ThemedToken } from "shiki";

export type SyntaxHighlightTone = "light" | "dark";

export type SyntaxHighlightToken = {
  content: string;
  style: Record<string, string>;
};

const SHIKI_THEMES: Record<SyntaxHighlightTone, BundledTheme> = {
  dark: "github-dark-default",
  light: "github-light-default",
};

const SUPPORTED_LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "vue",
  "html",
  "css",
  "scss",
  "markdown",
  "bash",
  "powershell",
  "yaml",
  "toml",
  "python",
  "go",
  "java",
  "sql",
] as const satisfies readonly BundledLanguage[];

const LANGUAGE_ALIAS_MAP: Record<string, BundledLanguage> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  vue: "vue",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  bash: "bash",
  shell: "bash",
  zsh: "bash",
  ps1: "powershell",
  psm1: "powershell",
  powershell: "powershell",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  py: "python",
  python: "python",
  go: "go",
  java: "java",
  sql: "sql",
};

const SPECIAL_FILENAME_LANGUAGE_MAP: Record<string, BundledLanguage> = {
  dockerfile: "bash",
  makefile: "bash",
};

const TOKEN_CACHE_MAX = 180;
const TOKEN_CACHE_KEEP = 140;

let highlighterPromise: Promise<Highlighter> | null = null;
const tokenCache = new Map<string, SyntaxHighlightToken[][]>();

const pruneCache = <T>(store: Map<string, T>, max: number, keep: number) => {
  if (store.size <= max) return;
  const staleKeys = [...store.keys()].slice(0, Math.max(0, store.size - keep));
  for (const key of staleKeys) store.delete(key);
};

const normalizePath = (value: string) => {
  const trimmed = String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed === "/dev/null") return "";
  const normalized = trimmed.replace(/\\/g, "/");
  return /^[ab]\//.test(normalized) ? normalized.slice(2) : normalized;
};

export const normalizeCodeLanguage = (value: string): BundledLanguage | "text" => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^language-/, "");
  if (!normalized) return "text";
  return LANGUAGE_ALIAS_MAP[normalized] ?? "text";
};

export const inferLanguageFromPath = (value: string): BundledLanguage | "text" => {
  const normalized = normalizePath(value);
  if (!normalized) return "text";
  const fileName = normalized.split("/").pop()?.toLowerCase() ?? "";
  if (fileName && SPECIAL_FILENAME_LANGUAGE_MAP[fileName]) return SPECIAL_FILENAME_LANGUAGE_MAP[fileName];
  const extension = fileName.includes(".") ? (fileName.split(".").pop()?.toLowerCase() ?? "") : "";
  return extension ? normalizeCodeLanguage(extension) : "text";
};

const getHighlighter = async () => {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: [SHIKI_THEMES.dark, SHIKI_THEMES.light],
        langs: [...SUPPORTED_LANGUAGES],
        warnings: false,
      })
    );
  }
  return highlighterPromise;
};

const toTokenStyle = (token: ThemedToken): Record<string, string> => {
  if (token.htmlStyle && typeof token.htmlStyle === "object") {
    return { ...token.htmlStyle };
  }
  const style: Record<string, string> = {};
  if (token.color) style.color = token.color;
  if (typeof token.fontStyle === "number") {
    if ((token.fontStyle & 1) !== 0) style.fontStyle = "italic";
    if ((token.fontStyle & 2) !== 0) style.fontWeight = "700";
    const decorations: string[] = [];
    if ((token.fontStyle & 4) !== 0) decorations.push("underline");
    if ((token.fontStyle & 8) !== 0) decorations.push("line-through");
    if (decorations.length > 0) style.textDecoration = decorations.join(" ");
  }
  return style;
};

export async function highlightCodeTokens(args: {
  code: string;
  language: string;
  tone: SyntaxHighlightTone;
}): Promise<SyntaxHighlightToken[][]> {
  const code = String(args.code ?? "");
  if (!code) return [];
  const language = normalizeCodeLanguage(args.language);
  if (language === "text") return [];
  const tone = args.tone === "light" ? "light" : "dark";
  const cacheKey = `${tone}::${language}::${code}`;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;

  const highlighter = await getHighlighter();
  const themedTokens = highlighter.codeToTokensBase(code, {
    lang: language,
    theme: SHIKI_THEMES[tone],
    tokenizeMaxLineLength: 4000,
    tokenizeTimeLimit: 700,
  });
  const mapped = themedTokens.map((line) =>
    line.map((token) => ({
      content: token.content,
      style: toTokenStyle(token),
    }))
  );
  tokenCache.set(cacheKey, mapped);
  pruneCache(tokenCache, TOKEN_CACHE_MAX, TOKEN_CACHE_KEEP);
  return mapped;
}

export function getCodeSyntaxHighlightCacheStats(): { items: number; bytes: number; updatedAt: number } {
  let bytes = 0;
  for (const [key, value] of tokenCache.entries()) {
    bytes += key.length;
    bytes += JSON.stringify(value).length;
  }
  return {
    items: tokenCache.size,
    bytes: Math.max(0, Math.round(bytes)),
    updatedAt: Date.now(),
  };
}

export function clearCodeSyntaxHighlightCache(): void {
  tokenCache.clear();
}
