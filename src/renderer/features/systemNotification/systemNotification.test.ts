import { describe, expect, test, vi } from "vitest";
import { notifyTurnCompleted, shouldSendSystemNotification } from "./systemNotification";

describe("system notification trigger policy", () => {
  test("does not send when the window is focused and visible", () => {
    expect(shouldSendSystemNotification({ focused: true, hidden: false, minimized: false })).toBe(false);
  });

  test("sends when the app is not focused, hidden, or minimized", () => {
    expect(shouldSendSystemNotification({ focused: false, hidden: false, minimized: false })).toBe(true);
    expect(shouldSendSystemNotification({ focused: true, hidden: true, minimized: false })).toBe(true);
    expect(shouldSendSystemNotification({ focused: true, hidden: false, minimized: true })).toBe(true);
  });

  test("calls the desktop API for completed turns when notification should be shown", async () => {
    const showSystemNotification = vi.fn().mockResolvedValue({ ok: true });

    await notifyTurnCompleted({
      app: { showSystemNotification },
      focused: false,
      hidden: false,
      minimized: false,
      threadTitle: "Feature work",
    });

    expect(showSystemNotification).toHaveBeenCalledWith({
      title: "任务完成",
      body: "Feature work 已完成一次回复。",
      silent: false,
    });
  });
});
