# src/renderer/features/history

## 目录用途

历史回放与线程历史辅助目录。

## 当前内容

| 文件 | 说明 |
| --- | --- |
| `replayParsers.ts` | 历史事件回放解析 |
| `threadHandoffDiagnostics.ts` | handoff transcript 诊断 |
| `threadHistoryItem.ts` | 历史项结构整理 |
| `threadMetadata.ts` | 线程元数据辅助 |
| `threadTitle.ts` | 标题生成与修正 |

## 维护边界

- ✅ 历史模型尽量与实时模型对齐

## 协作读取入口

- `runtime.readThreadContent(...)` 统一返回 `thread + messages + eventsPage` 快照
- 对应 IPC `history:threadContent`，默认窗口 `messageLimit=80`、`eventLimit=120`
