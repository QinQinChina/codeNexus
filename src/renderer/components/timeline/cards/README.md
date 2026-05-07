# src/renderer/components/timeline/cards

## 目录用途

时间线事件卡片内容目录。

## 当前内容

| 文件                               | 说明               |
| ---------------------------------- | ------------------ |
| `FileChangeCardContent.vue`        | 文件变更展示       |
| `WorkspaceFileSaveCardContent.vue` | 工作区文件保存事件 |
| `McpToolCardContent.vue`           | MCP 工具调用       |
| `McpResourceReadCardContent.vue`   | MCP 资源读取       |
| `DynamicToolCallCardContent.vue`   | 动态工具调用       |
| `TurnDiffSummaryCard.vue`          | 本回合 diff 摘要   |
| `UnifiedDiffViewer.vue`            | 统一 diff 视图     |

## 维护边界

- ✅ 组件仅消费 render model
- ✅ 新增卡片时同步补异常态与空态
