# src/preload

## 目录用途

Electron preload 层，在安全边界内通过 `contextBridge` 暴露受控 API。

## 当前内容

| 文件 / 目录  | 说明                   |
| ------------ | ---------------------- |
| `preload.ts` | preload 入口           |
| `api/`       | 频道、类型与客户端封装 |

## 维护边界

- ✅ 仅暴露最小必要 API 到 `window.codexDesktop`
- ❌ 不写 UI 逻辑与复杂业务流程
