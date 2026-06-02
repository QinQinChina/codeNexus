# src/shared

## 目录用途

主进程与渲染进程共用的类型、协议与轻量工具目录。

## 当前内容

| 目录 / 文件                                    | 说明                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `ipc/`                                         | 跨进程 IPC 频道与契约                                                     |
| `ipc/channels.ts` / `ipc/contracts.ts`         | IPC 单一事实来源（含 `history.getThreadContent` 与统一 `cache` 管理接口） |
| `codex-protocol/`                              | app-server 协议映射与类型导出                                             |
| `localSettings.ts`                             | 本地设置定义与归一化                                                      |
| `modelCatalog.ts`                              | 模型目录                                                                  |
| `localDraftState.ts` / `localMessageOutbox.ts` | 本地草稿与消息队列结构                                                    |

## 维护边界

- ✅ 仅保留跨层共享定义
- ❌ 不放主进程或渲染层专属实现
