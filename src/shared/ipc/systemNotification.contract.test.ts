import { describe, expect, test } from "vitest";
import { IPC_APP_CHANNELS } from "./channels";
import { createAppApi } from "../../preload/api/client/app";

describe("system notification IPC contract", () => {
  test("exposes an app channel and preload API for system notifications", () => {
    expect(IPC_APP_CHANNELS.appSystemNotificationShow).toBe("app:systemNotification:show");

    const invokeCalls: Array<[string, unknown]> = [];
    const api = createAppApi({
      invoke: (channel: string, args: unknown) => {
        invokeCalls.push([channel, args]);
        return Promise.resolve({ ok: true });
      },
    } as any);

    void api.showSystemNotification({ title: "Done", body: "Task completed" });

    expect(invokeCalls).toEqual([
      ["app:systemNotification:show", { title: "Done", body: "Task completed" }],
    ]);
  });
});
