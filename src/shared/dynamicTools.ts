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
export const IMAGE_GENERATION_DYNAMIC_TOOL_DEVELOPER_INSTRUCTIONS = [
  "For every user request to create, draw, render, or generate an image, call the codenexus.image_generate dynamic tool.",
  "If the user's current message includes image attachments, codenexus.image_generate automatically uses those attachments as reference images for image editing.",
  "Do not call image_gen, image_generation, or any official built-in image generation tool.",
  "If codenexus.image_generate is unavailable, explain that image generation is unavailable instead of using another image tool.",
].join("\n");

export const BUILTIN_DYNAMIC_TOOL_DEFINITIONS: Record<BuiltinDynamicToolName, BuiltinDynamicToolDefinition> = {
  image_generate: {
    namespace: IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE,
    name: IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
    label: "Generate image",
    description: `${IMAGE_GENERATION_DYNAMIC_TOOL_DEVELOPER_INSTRUCTIONS} Rewrite the user's request into a complete visual prompt before calling. When image attachments are present in the current user message, they are supplied automatically as reference images; do not include image bytes or paths in the tool arguments.`,
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
