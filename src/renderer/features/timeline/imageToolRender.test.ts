import { describe, expect, it } from "vitest";
import { buildImageToolItemFromProtocolItem } from "./imageToolRender";

describe("image tool render model", () => {
  it("renders completed imageGeneration thread items with data URLs", () => {
    const item = buildImageToolItemFromProtocolItem(
      {
        type: "imageGeneration",
        id: "img-1",
        status: "completed",
        revisedPrompt: "A neon cat",
        result: "data:image/png;base64,abc",
      },
      "item/completed"
    );

    expect(item?.status).toBe("completed");
    expect(item?.images).toEqual([
      expect.objectContaining({ sourceKind: "dataUrl", source: "data:image/png;base64,abc" }),
    ]);
    expect(item?.revisedPrompt).toContain("A neon cat");
  });

  it("renders raw image_generation_call response items", () => {
    const item = buildImageToolItemFromProtocolItem(
      {
        type: "image_generation_call",
        id: "call-1",
        status: "completed",
        revised_prompt: "A glass city",
        result: "https://example.test/generated.png",
      },
      "rawResponseItem/completed"
    );

    expect(item?.itemType).toBe("imageGeneration");
    expect(item?.images[0]).toEqual(
      expect.objectContaining({ sourceKind: "remoteUrl", source: "https://example.test/generated.png" })
    );
  });

  it("renders raw image_generation_call base64 results as data URLs", () => {
    const item = buildImageToolItemFromProtocolItem(
      {
        type: "image_generation_call",
        id: "call-2",
        status: "completed",
        revised_prompt: "A river at dusk",
        result: "iVBORw0KGgo=",
      },
      "rawResponseItem/completed"
    );

    expect(item?.images[0]).toEqual(
      expect.objectContaining({ sourceKind: "dataUrl", source: "data:image/png;base64,iVBORw0KGgo=" })
    );
  });

  it("prefers saved paths over embedded imageGeneration base64 results", () => {
    const item = buildImageToolItemFromProtocolItem(
      {
        type: "imageGeneration",
        id: "img-saved",
        status: "completed",
        revisedPrompt: null,
        result: "iVBORw0KGgo=",
        savedPath: "D:\\tmp\\generated.png",
      },
      "item/completed"
    );

    expect(item?.images).toEqual([expect.objectContaining({ sourceKind: "localPath", source: "D:\\tmp\\generated.png" })]);
  });

  it("renders saved paths and failed status", () => {
    const item = buildImageToolItemFromProtocolItem(
      {
        type: "imageGeneration",
        id: "img-2",
        status: "failed",
        revisedPrompt: null,
        result: "",
        savedPath: "D:\\tmp\\generated.png",
      },
      "item/completed"
    );

    expect(item?.status).toBe("failed");
    expect(item?.errorText).toContain("failed");
    expect(item?.images[0]).toEqual(expect.objectContaining({ sourceKind: "localPath" }));
  });

  it("renders imageView items as local path previews", () => {
    const item = buildImageToolItemFromProtocolItem(
      { type: "imageView", id: "view-1", path: "D:\\tmp\\input.png" },
      "item/completed"
    );

    expect(item?.itemType).toBe("imageView");
    expect(item?.images[0]).toEqual(expect.objectContaining({ sourceKind: "localPath" }));
  });
});
