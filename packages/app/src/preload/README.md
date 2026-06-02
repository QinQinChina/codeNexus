# packages/app/src/preload

## 目录用途

Electron preload 层，在安全边界内通过 `contextBridge` 暴露受控 API。

preload 聚合 app 基础 IPC 与 feature 包扩展 API，但不承载具体业务流程。

## 当前内容

| 文件 / 目录  | 说明                   |
| ------------ | ---------------------- |
| `preload.ts` | preload 入口           |
| `api/`       | 频道、类型与客户端封装 |

## 维护边界

- ✅ 仅暴露最小必要 API 到 `window.codexDesktop`
- ✅ 类型聚合可以引用 feature 包 API，但执行逻辑仍在主进程 handler 或服务层
- ❌ 不写 UI 逻辑与复杂业务流程
