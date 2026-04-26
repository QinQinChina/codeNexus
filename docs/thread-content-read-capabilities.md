# 线程内容读取能力总结（桌面端）

## 统一读取入口

| 层级 | 接口 |
| --- | --- |
| Renderer | `runtime.readThreadContent(params?)` |
| Preload | `codexDesktop.history.getThreadContent(args)` |
| IPC | `history:threadContent` |
| Main | `HistoryService.threadContent(args)` |

| 返回结构 |
| --- |
| `{ found, threadId, thread, messages, eventsPage }` |

## 当前可读取内容

| 模块 | 可读字段/内容 | 说明 |
| --- | --- | --- |
| `thread` | `id`、`title`、`updatedAt`、`sessionPath`、`source` | 线程基础元数据 |
| `thread` | `cwd`、`modelProvider` | 工作区与模型信息 |
| `thread` | `running`、`activeTurnId` | 线程运行态 |
| `thread` | `threadSourceKind`、`forkedFromId`、`agentNickname`、`agentRole`、`agentPath` | 协作/来源元信息 |
| `messages` | `role`（`user \| assistant`）、`text`、`timestamp?` | 消息窗口数据 |
| `messages` | 会话 `jsonl` 消息项 | 数据来源 |
| `messages` | 最近 N 条、连续重复去重 | 读取行为 |
| `eventsPage.entries[]` | `lineNo`、`timestamp?`、`type`、`payload?` | 事件条目 |
| `eventsPage` | `total`、`loaded`、`hasMore` | 分页状态 |
| `eventsPage` | 支持 `eventBefore` 翻页；`includeAux=true` 可包含辅助事件 | 事件读取策略 |

## 参数默认值

| 参数 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `threadId` | 是 | - | 目标线程 ID |
| `messageLimit` | 否 | `80` | 消息窗口大小 |
| `eventLimit` | 否 | `120` | 事件窗口大小 |
| `eventBefore` | 否 | `0` | 事件翻页偏移 |
| `includeAux` | 否 | `true` | 是否包含辅助事件 |

## 读取缓存策略

| 策略 | 说明 |
| --- | --- |
| 渲染层命中缓存 | `runtime.readThreadContent` 增加短 TTL 缓存（2s） |
| 事件驱动失效 | 收到 `history:updated` 后清空线程内容缓存 |
| 命名空间 | 统一缓存模块中为 `renderer.history.threadContent` |

## 线程不存在时返回

| 字段 | 值 |
| --- | --- |
| `found` | `false` |
| `thread` | `null` |
| `messages` | `[]` |
| `eventsPage` | `{ entries: [], total: 0, loaded: 0, hasMore: false }` |

## 调试入口

| 入口 | 作用 |
| --- | --- |
| `/thread-content` | 读取当前线程的 `messages + eventsPage` 并显示统计 |
