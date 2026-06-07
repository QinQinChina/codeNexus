import { describe, it, expect } from "vitest";
import {
  normalizeBuiltinDynamicToolName,
  buildBuiltinDynamicToolSpecs,
  filterEnabledBuiltinDynamicToolNames,
  BUILTIN_DYNAMIC_TOOL_DEFINITIONS,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE,
  BUILTIN_DYNAMIC_TOOL_NAMES,
} from "../dynamicTools";

describe("dynamicTools", () => {
  describe("normalizeBuiltinDynamicToolName", () => {
    it("returns image_generate for valid name", () => {
      expect(normalizeBuiltinDynamicToolName("image_generate")).toBe(
        "image_generate",
      );
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
      expect(normalizeBuiltinDynamicToolName("  image_generate  ")).toBe(
        "image_generate",
      );
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

    it("uses default BUILTIN_DYNAMIC_TOOL_NAMES when not specified", () => {
      const specs = buildBuiltinDynamicToolSpecs(BUILTIN_DYNAMIC_TOOL_NAMES);
      expect(specs.length).toBeGreaterThan(0);
    });
  });

  describe("filterEnabledBuiltinDynamicToolNames", () => {
    it("returns all tools when enabledByName is null/undefined", () => {
      expect(
        filterEnabledBuiltinDynamicToolNames(["image_generate"], null),
      ).toEqual(["image_generate"]);
      expect(
        filterEnabledBuiltinDynamicToolNames(["image_generate"], undefined),
      ).toEqual(["image_generate"]);
    });

    it("filters out explicitly disabled tools", () => {
      expect(
        filterEnabledBuiltinDynamicToolNames(["image_generate"], {
          image_generate: false,
        }),
      ).toEqual([]);
    });

    it("keeps explicitly enabled tools", () => {
      expect(
        filterEnabledBuiltinDynamicToolNames(["image_generate"], {
          image_generate: true,
        }),
      ).toEqual(["image_generate"]);
    });
  });

  describe("BUILTIN_DYNAMIC_TOOL_DEFINITIONS", () => {
    it("has valid input schema for image_generate", () => {
      const def = BUILTIN_DYNAMIC_TOOL_DEFINITIONS.image_generate;
      expect(def.name).toBe("image_generate");
      expect(def.requiresApproval).toBe(false);
      const schema = def.inputSchema as Record<string, unknown>;
      expect(schema.type).toBe("object");
      expect(schema.required).toContain("prompt");
    });
  });
});
