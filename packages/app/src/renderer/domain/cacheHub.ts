import { codexDesktop } from "../api/codexDesktopClient";
import { getRuntimeOrchestrator } from "./runtimeOrchestrator";
import type {
  CacheClearArgs,
  CacheClearResult,
  CacheListResult,
  CacheStatsItem,
} from "@codenexus/shared/ipc/contracts";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function mergeItems(items: CacheStatsItem[]): CacheStatsItem[] {
  const map = new Map<string, CacheStatsItem>();
  for (const item of items) {
    const namespace = String(item?.namespace ?? "").trim();
    if (!namespace) continue;
    map.set(namespace, { ...item, namespace });
  }
  return [...map.values()].sort((a, b) => a.namespace.localeCompare(b.namespace, "en"));
}

async function safeListRendererCaches(): Promise<CacheListResult> {
  try {
    const runtime = getRuntimeOrchestrator();
    return await runtime.listRendererCaches();
  } catch {
    return { items: [], generatedAt: Date.now() };
  }
}

async function safeClearRendererCaches(args?: CacheClearArgs): Promise<CacheClearResult> {
  try {
    const runtime = getRuntimeOrchestrator();
    return await runtime.clearRendererCaches(args);
  } catch {
    return {
      ok: true,
      cleared: [],
      skipped: [{ namespace: "", reason: "renderer-runtime-unavailable" }],
      items: [],
      generatedAt: Date.now(),
    };
  }
}

export async function listCache(args?: { scope?: "all" | "main" | "renderer" }): Promise<CacheListResult> {
  const scope = String(args?.scope ?? "all").trim();
  if (scope === "main") return await codexDesktop.cache.list({ scope: "main" });
  if (scope === "renderer") return await safeListRendererCaches();

  const [main, renderer] = await Promise.all([codexDesktop.cache.list({ scope: "main" }), safeListRendererCaches()]);
  return {
    items: mergeItems([...main.items, ...renderer.items]),
    generatedAt: Math.max(main.generatedAt, renderer.generatedAt),
  };
}

export async function clearCache(args?: CacheClearArgs): Promise<CacheClearResult> {
  const clearAll = Boolean(args?.clearAll);
  const namespaces = uniqueStrings(Array.isArray(args?.namespaces) ? args!.namespaces! : []);

  if (!clearAll && namespaces.length === 0) {
    const listed = await listCache({ scope: "all" });
    return {
      ok: true,
      cleared: [],
      skipped: [{ namespace: "", reason: "no-namespaces" }],
      items: listed.items,
      generatedAt: listed.generatedAt,
    };
  }

  const rendererNamespaces = clearAll ? [] : namespaces.filter((item) => item.startsWith("renderer."));
  const mainNamespaces = clearAll ? [] : namespaces.filter((item) => !item.startsWith("renderer."));

  const [main, renderer] = await Promise.all([
    clearAll
      ? codexDesktop.cache.clear({ clearAll: true })
      : mainNamespaces.length > 0
        ? codexDesktop.cache.clear({ namespaces: mainNamespaces })
        : Promise.resolve({ ok: true, cleared: [], skipped: [], items: [], generatedAt: Date.now() }),
    clearAll
      ? safeClearRendererCaches({ clearAll: true })
      : rendererNamespaces.length > 0
        ? safeClearRendererCaches({ namespaces: rendererNamespaces })
        : Promise.resolve({ ok: true, cleared: [], skipped: [], items: [], generatedAt: Date.now() }),
  ]);

  return {
    ok: true,
    cleared: uniqueStrings([...main.cleared, ...renderer.cleared]),
    skipped: [...main.skipped, ...renderer.skipped],
    items: mergeItems([...main.items, ...renderer.items]),
    generatedAt: Math.max(main.generatedAt, renderer.generatedAt),
  };
}
