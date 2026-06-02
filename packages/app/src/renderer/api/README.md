# packages/app/src/renderer/api

## 目录用途

渲染层访问桌面 API 的统一入口。

## 当前内容

| 文件                    | 说明                               |
| ----------------------- | ---------------------------------- |
| `codexDesktopClient.ts` | `window.codexDesktop` 的类型化封装 |

## 维护边界

- ✅ 业务代码统一从这里调用桌面 API
- ❌ 不在组件里直接访问全局 `window`
