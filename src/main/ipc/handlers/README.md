# src/main/ipc/handlers

## 目录用途

按业务域拆分主进程 IPC 处理器。

## 当前内容

| 文件 | 说明 |
| --- | --- |
| `app.handlers.ts` | 应用、窗口、更新、环境检查 |
| `codex.handlers.ts` | Codex server、线程、回合、协议桥接 |
| `cache.handlers.ts` | 统一缓存列表与清理 |
| `history.handlers.ts` | 历史会话读取 |
| `workspace.handlers.ts` | 工作区、文件树、编辑器相关 |
| `git.handlers.ts` | Git 状态、提交预览、提交动作 |
| `index.ts` | 汇总并注册全部 handler |

## 维护边界

- ✅ handler 命名与 IPC 频道保持对应
- ✅ 重逻辑下沉到 `src/main/services`
