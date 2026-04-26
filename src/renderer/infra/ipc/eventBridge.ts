import { codexDesktop } from "../../api/codexDesktopClient";
import { normalizeNotification, type NormalizedNotification } from "../../core/protocol/notifications";
import { isCodexServerNotificationMessage } from "../../../shared/codex-protocol";

// 通知监听器类型定义
export type NotificationListener = (notification: NormalizedNotification) => void;

// 事件桥接器接口
export type EventBridge = {
  start: () => void; // 启动事件监听
  stop: () => void; // 停止事件监听
  subscribe: (listener: NotificationListener) => () => void; // 订阅通知，返回取消订阅函数
};

// 创建事件桥接器实例
export function createEventBridge(): EventBridge {
  // 存储所有通知监听器
  const listeners = new Set<NotificationListener>();
  // 取消订阅函数
  let unsubscribe: (() => void) | null = null;

  // 分发通知给所有监听器
  const dispatch = (notification: NormalizedNotification) => {
    for (const listener of listeners) {
      listener(notification);
    }
  };

  // 启动事件监听
  const start = () => {
    if (unsubscribe) return; // 避免重复启动
    // 订阅 codexDesktop 的事件流
    unsubscribe = codexDesktop.codexServer.onEvent((payload) => {
      const msg = payload?.msg;
      // 验证消息是否为有效的服务端通知
      if (!isCodexServerNotificationMessage(msg)) return;
      // 规范化通知格式
      const normalized = normalizeNotification(msg, payload?.serverId);
      if (!normalized) return;
      // 分发给所有监听器
      dispatch(normalized);
    });
  };

  // 停止事件监听
  const stop = () => {
    if (!unsubscribe) return;
    unsubscribe(); // 调用取消订阅函数
    unsubscribe = null;
  };

  // 订阅通知
  const subscribe = (listener: NotificationListener) => {
    listeners.add(listener);
    // 返回取消订阅函数
    return () => {
      listeners.delete(listener);
    };
  };

  return { start, stop, subscribe };
}
