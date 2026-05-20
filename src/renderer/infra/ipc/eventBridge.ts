import { codexDesktop } from "../../api/codexDesktopClient";
import { normalizeNotification, type NormalizedNotification } from "../../core/protocol/notifications";
import { isCodexServerNotificationMessage } from "../../../shared/codex-protocol";

// Notification listener type.
export type NotificationListener = (notification: NormalizedNotification) => void;

// Event bridge interface.
export type EventBridge = {
  start: () => void; // Start event listening.
  stop: () => void; // Stop event listening.
  subscribe: (listener: NotificationListener) => () => void; // Subscribe and return an unsubscribe function.
};

// Create the event bridge instance.
export function createEventBridge(): EventBridge {
  // Store all notification listeners.
  const listeners = new Set<NotificationListener>();
  // Current unsubscribe function.
  let unsubscribe: (() => void) | null = null;

  // Dispatch notifications to every listener.
  const dispatch = (notification: NormalizedNotification) => {
    for (const listener of listeners) {
      listener(notification);
    }
  };

  // Start event listening.
  const start = () => {
    if (unsubscribe) return; // Avoid duplicate starts.
    // Subscribe to the codexDesktop event stream.
    unsubscribe = codexDesktop.codexServer.onEvent((payload) => {
      const msg = payload?.msg;
      // Validate that the message is a server notification.
      if (!isCodexServerNotificationMessage(msg)) return;
      // Normalize the notification format.
      const normalized = normalizeNotification(msg, payload?.serverId);
      if (!normalized) return;
      // Dispatch to all listeners.
      dispatch(normalized);
    });
  };

  // Stop event listening.
  const stop = () => {
    if (!unsubscribe) return;
    unsubscribe(); // Call the unsubscribe function.
    unsubscribe = null;
  };

  // Subscribe to notifications.
  const subscribe = (listener: NotificationListener) => {
    listeners.add(listener);
    // Return an unsubscribe function.
    return () => {
      listeners.delete(listener);
    };
  };

  return { start, stop, subscribe };
}
