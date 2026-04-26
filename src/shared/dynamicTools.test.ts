import { describe, expect, test } from "vitest";
import {
  BUILTIN_COMMANDER_DYNAMIC_TOOL_NAMES,
  BUILTIN_DYNAMIC_TOOL_NAMES,
  BUILTIN_WORKER_DYNAMIC_TOOL_NAMES,
  buildBuiltinDynamicToolSpecs,
  filterEnabledBuiltinDynamicToolNames,
  normalizeBuiltinDynamicToolName,
} from "./dynamicTools";

describe("dynamic tools helpers", () => {
  test("does not expose removed workflow tools", () => {
    expect(BUILTIN_DYNAMIC_TOOL_NAMES).toEqual([]);
    expect(BUILTIN_COMMANDER_DYNAMIC_TOOL_NAMES).toEqual([]);
    expect(BUILTIN_WORKER_DYNAMIC_TOOL_NAMES).toEqual([]);
    expect(buildBuiltinDynamicToolSpecs()).toEqual([]);
    expect(normalizeBuiltinDynamicToolName("workflow_task_create")).toBeNull();
  });

  test("filters empty dynamic tool lists", () => {
    expect(filterEnabledBuiltinDynamicToolNames([], {})).toEqual([]);
  });
});
