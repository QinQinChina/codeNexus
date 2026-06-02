import { ipcMain } from "electron";
import { IPC_CACHE_CHANNELS } from "@codenexus/shared/ipc/channels";
import type { CacheClearArgs } from "@codenexus/shared/ipc/contracts";
import type { CacheRegistryService } from "../../services/CacheRegistryService";

function normalizeScope(value: unknown): "all" | "main" | "renderer" {
  const text = String(value ?? "").trim();
  if (text === "main") return "main";
  if (text === "renderer") return "renderer";
  return "all";
}

export function registerCacheHandlers(deps: { cacheRegistryService: CacheRegistryService }) {
  const { cacheRegistryService } = deps;

  ipcMain.handle(IPC_CACHE_CHANNELS.cacheList, async (_evt, args?: { scope?: "all" | "main" | "renderer" }) => {
    const listed = await cacheRegistryService.list();
    const scope = normalizeScope(args?.scope);
    if (scope === "all") return listed;
    return {
      ...listed,
      items: listed.items.filter((item) => item.scope === scope),
    };
  });

  ipcMain.handle(IPC_CACHE_CHANNELS.cacheClear, async (_evt, args?: CacheClearArgs) => {
    return await cacheRegistryService.clear(args);
  });
}
