import { describe, expect, test } from "vitest";
import { BUILTIN_MODEL_IDS, DEFAULT_MODEL_NAME, buildAvailableModelIds, buildModelPickerOptions } from "./modelCatalog";

describe("model catalog", () => {
  test("uses gpt-5.5 as the default builtin model", () => {
    expect(DEFAULT_MODEL_NAME).toBe("gpt-5.5");
    expect(BUILTIN_MODEL_IDS[0]).toBe("gpt-5.5");
  });

  test("includes current GPT-5 and Codex builtin models", () => {
    expect(BUILTIN_MODEL_IDS).toEqual([
      "gpt-5.5",
      "gpt-5.2",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
      "gpt-5.3-codex-spark",
    ]);
  });

  test("keeps builtin models out of custom additions", () => {
    expect(buildAvailableModelIds(["gpt-5.5", "gpt-5.3-codex-spark", "custom-model"])).toEqual([
      "gpt-5.5",
      "gpt-5.2",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
      "gpt-5.3-codex-spark",
      "custom-model",
    ]);
  });

  test("keeps an unavailable current model visible in the picker", () => {
    expect(buildModelPickerOptions({ customIds: [], current: "temporary-model" })).toEqual([
      "temporary-model",
      "gpt-5.5",
      "gpt-5.2",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
      "gpt-5.3-codex-spark",
    ]);
  });
});
