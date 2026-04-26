import { describe, expect, it } from "vitest";
import {
  buildProtocolNoticeTimelineText,
  buildProtocolNoticeToast,
} from "./protocolNoticeRender";

describe("protocol notice render helpers", () => {
  it("builds user-visible warning notice text", () => {
    expect(
      buildProtocolNoticeToast({ method: "warning", params: { threadId: "thread-1", message: "Network disabled" } })
    ).toEqual({ kind: "warn", title: "Codex 警告", message: "Network disabled", timeoutMs: 7000 });
    expect(buildProtocolNoticeTimelineText("warning", { message: "Network disabled" })).toBe("Codex 警告：Network disabled");
  });

  it("builds guardian warning notice text", () => {
    expect(
      buildProtocolNoticeToast({ method: "guardianWarning", params: { threadId: "thread-1", message: "Action blocked" } })
    ).toEqual({ kind: "warn", title: "Guardian 警告", message: "Action blocked", timeoutMs: 9000 });
    expect(buildProtocolNoticeTimelineText("guardianWarning", { message: "Action blocked" })).toBe(
      "Guardian 警告：Action blocked"
    );
  });

  it("summarizes model verification notifications", () => {
    expect(
      buildProtocolNoticeToast({
        method: "model/verification",
        params: { threadId: "thread-1", turnId: "turn-1", verifications: ["trustedAccessForCyber"] },
      })
    ).toEqual({
      kind: "info",
      title: "模型验证",
      message: "trustedAccessForCyber",
      timeoutMs: 5000,
    });
    expect(
      buildProtocolNoticeTimelineText("model/verification", { verifications: ["trustedAccessForCyber"] })
    ).toBe("模型验证：trustedAccessForCyber");
  });
});
