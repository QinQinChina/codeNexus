import { describe, expect, it } from "vitest";
import type { MemoryResetResponse } from "../../generated/codex-app-server/v2/MemoryResetResponse";
import type { ThreadMemoryModeSetResponse } from "../../generated/codex-app-server/v2/ThreadMemoryModeSetResponse";
import type { CodexRpcResult } from "./types";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type _MemoryResetResult = Expect<Equal<CodexRpcResult<"memory/reset">, MemoryResetResponse>>;
type _ThreadMemoryModeSetResult = Expect<
  Equal<CodexRpcResult<"thread/memoryMode/set">, ThreadMemoryModeSetResponse>
>;

describe("Codex memory protocol result types", () => {
  it("maps empty memory responses without falling back to unknown", () => {
    const resetResult: CodexRpcResult<"memory/reset"> = {};
    const modeResult: CodexRpcResult<"thread/memoryMode/set"> = {};

    expect(resetResult).toEqual({});
    expect(modeResult).toEqual({});
  });
});
