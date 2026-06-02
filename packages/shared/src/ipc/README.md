# src/shared/ipc

## 目录用途

跨进程 IPC 协议定义目录。

## 当前内容

| 文件           | 说明             |
| -------------- | ---------------- |
| `channels.ts`  | 频道常量         |
| `contracts.ts` | 参数与返回值契约 |
| `index.ts`     | 导出入口         |

## 维护边界

- ✅ 频道与契约必须同步维护
- ✅ 变更后同时校验 main / preload / renderer 三层
