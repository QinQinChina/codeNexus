export type BuiltinDynamicToolName = "image_generate";

export type BuiltinDynamicToolDefinition = {
  name: BuiltinDynamicToolName;
  namespace?: string;
  label: string;
  description: string;
  requiresApproval: boolean;
  inputSchema: Record<string, unknown>;
};

export const IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE = "codenexus";
export const IMAGE_GENERATION_DYNAMIC_TOOL_NAME: BuiltinDynamicToolName = "image_generate";

export const BUILTIN_DYNAMIC_TOOL_DEFINITIONS: Record<BuiltinDynamicToolName, BuiltinDynamicToolDefinition> = {
  image_generate: {
    namespace: IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE,
    name: IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
    label: "生成图片",
    description:
      "Generate an image only when the user explicitly asks to create, draw, or render an image. Rewrite the user's request into a complete visual prompt before calling.",
    requiresApproval: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: {
          type: "string",
          minLength: 1,
          description:
            "A complete image prompt describing subject, composition, style, colors, text, and any constraints requested by the user.",
        },
        size: {
          type: "string",
          description: "Optional output size, for example 1024x1024, 1024x1536, 1536x1024, or auto.",
        },
        quality: {
          type: "string",
          description: "Optional quality hint such as auto, low, medium, or high.",
        },
        output_format: {
          type: "string",
          description: "Optional output format such as png, jpeg, or webp.",
        },
        n: {
          type: "integer",
          minimum: 1,
          maximum: 4,
          description: "Number of images to generate.",
        },
      },
      required: ["prompt"],
    },
  },
};

export const BUILTIN_COMMANDER_DYNAMIC_TOOL_NAMES: BuiltinDynamicToolName[] = [IMAGE_GENERATION_DYNAMIC_TOOL_NAME];

export const BUILTIN_WORKER_DYNAMIC_TOOL_NAMES: BuiltinDynamicToolName[] = [IMAGE_GENERATION_DYNAMIC_TOOL_NAME];

export const BUILTIN_DYNAMIC_TOOL_NAMES: BuiltinDynamicToolName[] = [IMAGE_GENERATION_DYNAMIC_TOOL_NAME];

export type DynamicToolSpecLike = {
  namespace?: string;
  name: string;
  description: string;
  inputSchema: unknown;
  deferLoading?: boolean;
};

export function normalizeBuiltinDynamicToolName(value: unknown): BuiltinDynamicToolName | null {
  return String(value ?? "").trim() === IMAGE_GENERATION_DYNAMIC_TOOL_NAME ? IMAGE_GENERATION_DYNAMIC_TOOL_NAME : null;
}

export function buildBuiltinDynamicToolSpecs(names: BuiltinDynamicToolName[] = []): DynamicToolSpecLike[] {
  return names
    .map((name) => BUILTIN_DYNAMIC_TOOL_DEFINITIONS[name])
    .filter(Boolean)
    .map((definition) => ({
      namespace: definition.namespace,
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      deferLoading: false,
    }));
}

export function filterEnabledBuiltinDynamicToolNames(
  names: BuiltinDynamicToolName[],
  enabledByName: Partial<Record<BuiltinDynamicToolName, boolean>> | null | undefined
): BuiltinDynamicToolName[] {
  return names.filter((name) => enabledByName?.[name] !== false);
}
