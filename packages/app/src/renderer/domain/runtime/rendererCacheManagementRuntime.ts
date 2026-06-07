import type { CacheClearArgs, CacheClearResult, CacheListResult } from "@codenexus/shared/ipc/contracts";
import type { RuntimeRendererCacheContext } from "./rendererCacheRegistry";

export type RendererCacheManagementRuntime = {
  listRendererCaches: () => Promise<CacheListResult>;
  clearRendererCaches: (args?: CacheClearArgs) => Promise<CacheClearResult>;
};

export function createRendererCacheManagementRuntime(
  context: RuntimeRendererCacheContext
): RendererCacheManagementRuntime {
  const listRendererCaches = async (): Promise<CacheListResult> => {
    const { listRendererCachesForRuntime } = await import("./rendererCacheRegistry");
    return listRendererCachesForRuntime(context);
  };

  const clearRendererCaches = async (args?: CacheClearArgs): Promise<CacheClearResult> => {
    const { clearRendererCachesForRuntime } = await import("./rendererCacheRegistry");
    return clearRendererCachesForRuntime(context, args);
  };

  return { listRendererCaches, clearRendererCaches };
}
