import { describe, expect, test } from "vitest";
import {
  buildThreadStartConfigOverridesForModel,
  hasThreadStartConfigOverridesForModel,
} from "./modelToolFeatureOverrides";

describe("model tool feature overrides", () => {
  test("disables image generation only for gpt-5.3-codex-spark", () => {
    expect(buildThreadStartConfigOverridesForModel("gpt-5.3-codex-spark")).toEqual({
      "features.image_generation": false,
    });
    expect(buildThreadStartConfigOverridesForModel(" gpt-5.3-codex-spark ")).toEqual({
      "features.image_generation": false,
    });
  });

  test("does not disable image generation for other models", () => {
    expect(buildThreadStartConfigOverridesForModel("gpt-5.3-codex")).toBeNull();
    expect(buildThreadStartConfigOverridesForModel("gpt-5.4")).toBeNull();
    expect(buildThreadStartConfigOverridesForModel("gpt-5.3-codex-spark-preview")).toBeNull();
  });

  test("detects whether a thread already has required Spark overrides", () => {
    expect(hasThreadStartConfigOverridesForModel(null, "gpt-5.3-codex-spark")).toBe(false);
    expect(hasThreadStartConfigOverridesForModel({}, "gpt-5.3-codex-spark")).toBe(false);
    expect(
      hasThreadStartConfigOverridesForModel({ "features.image_generation": true }, "gpt-5.3-codex-spark")
    ).toBe(false);
    expect(
      hasThreadStartConfigOverridesForModel({ "features.image_generation": false }, "gpt-5.3-codex-spark")
    ).toBe(true);
  });

  test("does not require overrides for models without tool feature overrides", () => {
    expect(hasThreadStartConfigOverridesForModel(null, "gpt-5.4")).toBe(true);
  });
});
