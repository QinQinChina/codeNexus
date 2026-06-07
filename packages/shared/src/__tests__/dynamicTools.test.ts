import { describe, it, expect, beforeEach } from "vitest";
import {
  DynamicToolRegistry,
  dynamicToolRegistry,
  normalizeBuiltinDynamicToolName,
  buildBuiltinDynamicToolSpecs,
  filterEnabledBuiltinDynamicToolNames,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE,
  BUILTIN_DYNAMIC_TOOL_NAMES,
} from "../dynamicTools";

describe("DynamicToolRegistry", () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    registry = new DynamicToolRegistry();
  });

  it("starts empty", () => {
    expect(registry.getAllNames()).toEqual([]);
    expect(registry.getAllDefinitions()).toEqual([]);
  });

  it("registers and retrieves a tool", () => {
    registry.register({
      name: "test_tool",
      namespace: "test",
      label: "Test Tool",
      description: "A test tool",
      requiresApproval: false,
      inputSchema: { type: "object", properties: {} },
    });
    expect(registry.isKnownToolName("test_tool")).toBe(true);
    expect(registry.getDefinition("test_tool")?.label).toBe("Test Tool");
    expect(registry.getAllNames()).toEqual(["test_tool"]);
  });

  it("unregisters a tool", () => {
    registry.register({
      name: "temp_tool",
      label: "Temp",
      description: "Temporary",
      requiresApproval: false,
      inputSchema: {},
    });
    expect(registry.isKnownToolName("temp_tool")).toBe(true);
    registry.unregister("temp_tool");
    expect(registry.isKnownToolName("temp_tool")).toBe(false);
  });

  it("buildEnabledSpecs filters by enabledByName", () => {
    registry.register({
      name: "tool_a",
      label: "A",
      description: "Tool A",
      requiresApproval: false,
      inputSchema: {},
    });
    registry.register({
      name: "tool_b",
      label: "B",
      description: "Tool B",
      requiresApproval: true,
      inputSchema: {},
    });

    const allSpecs = registry.buildEnabledSpecs(null);
    expect(allSpecs).toHaveLength(2);

    const filtered = registry.buildEnabledSpecs({ tool_a: false });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("tool_b");
  });

  it("buildDefaultEnabledByName enables all registered tools", () => {
    registry.register({
      name: "tool_x",
      label: "X",
      description: "X",
      requiresApproval: false,
      inputSchema: {},
    });
    registry.register({
      name: "tool_y",
      label: "Y",
      description: "Y",
      requiresApproval: false,
      inputSchema: {},
    });
    expect(registry.buildDefaultEnabledByName()).toEqual({
      tool_x: true,
      tool_y: true,
    });
  });
});

describe("dynamicToolRegistry singleton", () => {
  it("has image_generate registered by default", () => {
    expect(dynamicToolRegistry.isKnownToolName("image_generate")).toBe(true);
    const def = dynamicToolRegistry.getDefinition("image_generate");
    expect(def?.namespace).toBe(IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE);
    expect(def?.name).toBe(IMAGE_GENERATION_DYNAMIC_TOOL_NAME);
    expect(def?.requiresApproval).toBe(false);
    const schema = def?.inputSchema as Record<string, unknown>;
    expect(schema.required).toContain("prompt");
  });

  it("allows registering additional tools at runtime", () => {
    dynamicToolRegistry.register({
      name: "custom_search",
      namespace: "codenexus",
      label: "Custom Search",
      description: "Searches local files",
      requiresApproval: false,
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    });
    expect(dynamicToolRegistry.isKnownToolName("custom_search")).toBe(true);
    // Clean up
    dynamicToolRegistry.unregister("custom_search");
  });
});

describe("backward-compatible exports", () => {
  describe("normalizeBuiltinDynamicToolName", () => {
    it("returns image_generate for valid name", () => {
      expect(normalizeBuiltinDynamicToolName("image_generate")).toBe("image_generate");
    });

    it("returns null for unknown name", () => {
      expect(normalizeBuiltinDynamicToolName("unknown_tool")).toBeNull();
    });

    it("returns null for empty/null/undefined", () => {
      expect(normalizeBuiltinDynamicToolName("")).toBeNull();
      expect(normalizeBuiltinDynamicToolName(null)).toBeNull();
      expect(normalizeBuiltinDynamicToolName(undefined)).toBeNull();
    });

    it("trims whitespace", () => {
      expect(normalizeBuiltinDynamicToolName("  image_generate  ")).toBe("image_generate");
    });
  });

  describe("buildBuiltinDynamicToolSpecs", () => {
    it("returns empty array for empty input", () => {
      expect(buildBuiltinDynamicToolSpecs([])).toEqual([]);
    });

    it("builds specs for known tool names", () => {
      const specs = buildBuiltinDynamicToolSpecs(["image_generate"]);
      expect(specs).toHaveLength(1);
      expect(specs[0].name).toBe(IMAGE_GENERATION_DYNAMIC_TOOL_NAME);
      expect(specs[0].namespace).toBe(IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE);
      expect(specs[0].inputSchema).toBeDefined();
      expect(specs[0].deferLoading).toBe(false);
    });

    it("uses BUILTIN_DYNAMIC_TOOL_NAMES", () => {
      const specs = buildBuiltinDynamicToolSpecs(BUILTIN_DYNAMIC_TOOL_NAMES);
      expect(specs.length).toBeGreaterThan(0);
    });
  });

  describe("filterEnabledBuiltinDynamicToolNames", () => {
    it("returns all tools when enabledByName is null/undefined", () => {
      expect(filterEnabledBuiltinDynamicToolNames(["image_generate"], null)).toEqual(["image_generate"]);
      expect(filterEnabledBuiltinDynamicToolNames(["image_generate"], undefined)).toEqual(["image_generate"]);
    });

    it("filters out explicitly disabled tools", () => {
      expect(filterEnabledBuiltinDynamicToolNames(["image_generate"], { image_generate: false })).toEqual([]);
    });

    it("keeps explicitly enabled tools", () => {
      expect(filterEnabledBuiltinDynamicToolNames(["image_generate"], { image_generate: true })).toEqual([
        "image_generate",
      ]);
    });
  });
});
