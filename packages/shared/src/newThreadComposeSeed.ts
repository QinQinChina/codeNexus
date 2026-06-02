export type NewThreadComposeSeed<TComposeMode extends string = string> = {
  composeMode: TComposeMode;
  model: string;
  reasoningEffort: string;
  reasoningSummary: string;
  sandboxMode: string;
};

export type NewThreadComposeSeedDefaults = Omit<NewThreadComposeSeed, "composeMode">;

function hasPreviousThread(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

function pickRuntimeOrGlobal(runtimeValue: string, globalValue: string, useRuntime: boolean): string {
  const runtime = String(runtimeValue ?? "").trim();
  if (useRuntime && runtime) return runtime;
  return String(globalValue ?? "").trim();
}

export function buildNewThreadComposeSeed<TComposeMode extends string>(args: {
  previousThreadId: unknown;
  runtime: NewThreadComposeSeed<TComposeMode>;
  global: NewThreadComposeSeedDefaults;
}): NewThreadComposeSeed<TComposeMode> {
  const useRuntime = !hasPreviousThread(args.previousThreadId);
  return {
    composeMode: args.runtime.composeMode,
    model: pickRuntimeOrGlobal(args.runtime.model, args.global.model, useRuntime),
    reasoningEffort: pickRuntimeOrGlobal(args.runtime.reasoningEffort, args.global.reasoningEffort, useRuntime),
    reasoningSummary: pickRuntimeOrGlobal(args.runtime.reasoningSummary, args.global.reasoningSummary, useRuntime),
    sandboxMode: pickRuntimeOrGlobal(args.runtime.sandboxMode, args.global.sandboxMode, useRuntime),
  };
}
