# packages/shared/src/ipc

## 目录用途

`@codenexus/shared` 内的跨进程 IPC 协议定义目录。

这里维护 app 基础频道和基础契约；功能包扩展 API 由 app preload 层聚合到最终 `window.codexDesktop` 类型中。

## 当前内容

| 文件           | 说明             |
| -------------- | ---------------- |
| `channels.ts`  | 频道常量         |
| `contracts.ts` | 参数与返回值契约 |
| `index.ts`     | 导出入口         |

## 维护边界

- ✅ 频道与契约必须同步维护
- ✅ shared 只放跨层稳定契约，不放 feature 专属实现
- ✅ 变更后同时校验 main / preload / renderer 三层
