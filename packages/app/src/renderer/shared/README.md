# packages/app/src/renderer/shared

## 目录用途

渲染层共享工具目录。

## 当前内容

| 文件                   | 说明               |
| ---------------------- | ------------------ |
| `debugLog.ts`          | 调试日志裁剪与输出 |
| `ipcErrors.ts`         | IPC 错误规范化     |
| `sandboxPolicy.ts`     | 沙箱策略辅助       |
| `threadCreateDebug.ts` | 线程创建调试辅助   |

## 维护边界

- ✅ 仅放轻量、可复用工具
- ❌ 不放单一业务域逻辑
