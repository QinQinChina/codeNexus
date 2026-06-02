import type {
  CacheClearArgs,
  CacheClearResult,
  CacheListResult,
  CacheScope,
  CacheStatsItem,
} from "@codenexus/shared/ipc/contracts";

export type CacheProviderStats = {
  items: number;
  bytes: number;
  updatedAt?: number;
  note?: string;
};

export type CacheProvider = {
  namespace: string;
  scope?: CacheScope;
  clearable?: boolean;
  getStats: () => Promise<CacheProviderStats> | CacheProviderStats;
  clear?: () => Promise<void> | void;
};

function normalizeNamespace(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCount(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

function normalizeScope(value: unknown): CacheScope {
  return String(value ?? "").trim() === "renderer" ? "renderer" : "main";
}

export class CacheRegistryService {
  private readonly providers = new Map<string, CacheProvider>();

  registerProvider(provider: CacheProvider): () => void {
    const namespace = normalizeNamespace(provider.namespace);
    if (!namespace) throw new Error("cache provider namespace is required");
    const normalized: CacheProvider = {
      ...provider,
      namespace,
      scope: normalizeScope(provider.scope),
      clearable: provider.clearable !== false && typeof provider.clear === "function",
    };
    this.providers.set(namespace, normalized);
    return () => {
      const current = this.providers.get(namespace);
      if (current === normalized) this.providers.delete(namespace);
    };
  }

  private toItem(namespace: string, provider: CacheProvider, stats: CacheProviderStats): CacheStatsItem {
    return {
      namespace,
      scope: normalizeScope(provider.scope),
      clearable: provider.clearable !== false && typeof provider.clear === "function",
      items: normalizeCount(stats.items),
      bytes: normalizeCount(stats.bytes),
      updatedAt: normalizeCount(stats.updatedAt ?? Date.now()),
      note: String(stats.note ?? "").trim() || undefined,
    };
  }

  async list(): Promise<CacheListResult> {
    const items: CacheStatsItem[] = [];
    for (const [namespace, provider] of this.providers.entries()) {
      try {
        const stats = await provider.getStats();
        items.push(this.toItem(namespace, provider, stats));
      } catch (error: any) {
        items.push({
          namespace,
          scope: normalizeScope(provider.scope),
          clearable: provider.clearable !== false && typeof provider.clear === "function",
          items: 0,
          bytes: 0,
          updatedAt: Date.now(),
          note: `stats-error: ${String(error?.message ?? error ?? "unknown error")}`,
        });
      }
    }
    items.sort((a, b) => a.namespace.localeCompare(b.namespace, "en"));
    return {
      items,
      generatedAt: Date.now(),
    };
  }

  async clear(args?: CacheClearArgs): Promise<CacheClearResult> {
    const clearAll = Boolean(args?.clearAll);
    const requestedNamespaces = Array.isArray(args?.namespaces)
      ? args.namespaces.map((item) => normalizeNamespace(item)).filter(Boolean)
      : [];
    const requestedSet = new Set(requestedNamespaces);

    const cleared: string[] = [];
    const skipped: CacheClearResult["skipped"] = [];

    if (!clearAll && requestedSet.size === 0) {
      const listed = await this.list();
      return {
        ok: true,
        cleared,
        skipped: [{ namespace: "", reason: "no-namespaces" }],
        items: listed.items,
        generatedAt: listed.generatedAt,
      };
    }

    const targets = clearAll ? [...this.providers.keys()] : [...requestedSet];
    for (const namespace of targets) {
      const provider = this.providers.get(namespace);
      if (!provider) {
        skipped.push({ namespace, reason: "not-found" });
        continue;
      }
      if (provider.clearable === false || typeof provider.clear !== "function") {
        skipped.push({ namespace, reason: "not-clearable" });
        continue;
      }
      try {
        await provider.clear();
        cleared.push(namespace);
      } catch (error: any) {
        skipped.push({
          namespace,
          reason: `clear-failed: ${String(error?.message ?? error ?? "unknown error")}`,
        });
      }
    }

    const listed = await this.list();
    return {
      ok: true,
      cleared,
      skipped,
      items: listed.items,
      generatedAt: listed.generatedAt,
    };
  }
}
