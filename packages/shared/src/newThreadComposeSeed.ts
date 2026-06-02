/**
 * 新线程输入框的初始种子。
 *
 * 创建全新线程时优先沿用运行时选择；从已有线程派生时回落到全局默认，避免误继承旧线程状态。
 */
export type NewThreadComposeSeed<TComposeMode extends string = string> = {
  composeMode: TComposeMode;
  model: string;
  reasoningEffort: string;
  reasoningSummary: string;
  sandboxMode: string;
};

export type NewThreadComposeSeedDefaults = Omit<
  NewThreadComposeSeed,
  "composeMode"
>;

/** previousThreadId 为空表示用户在创建全新线程，可继续使用当前输入区运行时选择。 */
function hasPreviousThread(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

/** 运行时值仅在全新线程中优先生效；否则使用全局默认避免从旧线程串状态。 */
function pickRuntimeOrGlobal(
  runtimeValue: string,
  globalValue: string,
  useRuntime: boolean,
): string {
  const runtime = String(runtimeValue ?? "").trim();
  if (useRuntime && runtime) return runtime;
  return String(globalValue ?? "").trim();
}

/**
 * 构造新线程输入区初始值。
 *
 * composeMode 始终来自当前运行时入口；模型、reasoning 和沙箱按是否派生旧线程决定来源。
 */
export function buildNewThreadComposeSeed<TComposeMode extends string>(args: {
  previousThreadId: unknown;
  runtime: NewThreadComposeSeed<TComposeMode>;
  global: NewThreadComposeSeedDefaults;
}): NewThreadComposeSeed<TComposeMode> {
  const useRuntime = !hasPreviousThread(args.previousThreadId);
  return {
    composeMode: args.runtime.composeMode,
    model: pickRuntimeOrGlobal(
      args.runtime.model,
      args.global.model,
      useRuntime,
    ),
    reasoningEffort: pickRuntimeOrGlobal(
      args.runtime.reasoningEffort,
      args.global.reasoningEffort,
      useRuntime,
    ),
    reasoningSummary: pickRuntimeOrGlobal(
      args.runtime.reasoningSummary,
      args.global.reasoningSummary,
      useRuntime,
    ),
    sandboxMode: pickRuntimeOrGlobal(
      args.runtime.sandboxMode,
      args.global.sandboxMode,
      useRuntime,
    ),
  };
}
