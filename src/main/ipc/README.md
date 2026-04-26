# src/main/ipc

## 目录用途

主进程 IPC 注册层，负责把渲染层请求路由到具体 handler 与 service。

## 当前内容

| 文件 / 目录 | 说明 |
| --- | --- |
| `handlers/index.ts` | 统一注册入口 |
| `handlers/app.handlers.ts` | 应用与窗口相关 IPC |
| `handlers/codex.handlers.ts` | Codex 线程、回合、协议相关 IPC |
| `handlers/history.handlers.ts` | 历史回放与读取 |
| `handlers/cache.handlers.ts` | 统一缓存查询与清理 |
| `handlers/workspace.handlers.ts` | 工作区与文件操作 |
| `handlers/git.handlers.ts` | Git 读写与摘要 |

## 维护边界

- ✅ IPC 层只做参数整理、权限边界与转发
- ❌ 不在这里堆复杂业务逻辑
