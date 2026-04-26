# src/renderer/infra/ipc

## 目录用途

渲染层 IPC 适配目录。

## 当前内容

| 文件 | 说明 |
| --- | --- |
| `eventBridge.ts` | IPC 事件桥接与订阅管理 |

## 维护边界

- ✅ IPC 细节在这里收敛
- ✅ 注意订阅释放与生命周期管理
