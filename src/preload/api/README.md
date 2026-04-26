# src/preload/api

## 目录用途

预加载 API 契约与客户端实现目录。

## 当前内容

| 文件 | 说明 |
| --- | --- |
| `channels.ts` | preload 侧频道常量 |
| `types.ts` | 暴露给 renderer 的 API 类型 |
| `client.ts` | 基于 `ipcRenderer` 的实现 |

## 维护边界

- ✅ 新增能力时同步更新 `channels / types / client`
- ✅ 与 `src/shared/ipc` 保持一致
