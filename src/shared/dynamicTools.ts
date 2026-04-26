export type BuiltinDynamicToolName = never;

export type BuiltinDynamicToolDefinition = {
  name: BuiltinDynamicToolName;
  label: string;
  description: string;
  requiresApproval: boolean;
  inputSchema: Record<string, unknown>;
};

export const BUILTIN_DYNAMIC_TOOL_DEFINITIONS: Record<BuiltinDynamicToolName, BuiltinDynamicToolDefinition> = {};

export const BUILTIN_COMMANDER_DYNAMIC_TOOL_NAMES: BuiltinDynamicToolName[] = [];

export const BUILTIN_WORKER_DYNAMIC_TOOL_NAMES: BuiltinDynamicToolName[] = [];

export const BUILTIN_DYNAMIC_TOOL_NAMES: BuiltinDynamicToolName[] = [];

export type DynamicToolSpecLike = {
  name: string;
  description: string;
  inputSchema: unknown;
  deferLoading?: boolean;
};

export function normalizeBuiltinDynamicToolName(_value: unknown): BuiltinDynamicToolName | null {
  return null;
}

export function buildBuiltinDynamicToolSpecs(_names: BuiltinDynamicToolName[] = []): DynamicToolSpecLike[] {
  return [];
}

export function filterEnabledBuiltinDynamicToolNames(
  names: BuiltinDynamicToolName[],
  _enabledByName: Partial<Record<BuiltinDynamicToolName, boolean>> | null | undefined
): BuiltinDynamicToolName[] {
  return names;
}
