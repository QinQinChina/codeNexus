export type RuntimeDisposeRuntimeDeps = {
  flushPendingComposeStateSaves: () => void;
  disposeSkillsManagement: () => void;
  disposeMcpManagement: () => void;
  disposers: Array<() => void>;
  clearRuntimeOrchestrator: () => void;
};

export type RuntimeDisposeRuntime = {
  dispose: () => void;
};

export function createRuntimeDisposeRuntime(deps: RuntimeDisposeRuntimeDeps): RuntimeDisposeRuntime {
  const dispose = () => {
    try {
      deps.flushPendingComposeStateSaves();
    } catch {}
    deps.disposeSkillsManagement();
    deps.disposeMcpManagement();
    for (const runDispose of deps.disposers) {
      try {
        runDispose();
      } catch {}
    }
    deps.clearRuntimeOrchestrator();
  };

  return { dispose };
}
