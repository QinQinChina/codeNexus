# src/main

## 目录用途

Electron 主进程目录，负责应用生命周期、窗口、app-server 管理、IPC 注册与系统级服务。

## 当前内容

| 文件 / 目录 | 说明 |
| --- | --- |
| `main.ts` | 主进程入口 |
| `codexAppServer.ts` | Codex app-server 进程封装 |
| `historyStore.ts` | 历史会话存取 |
| `runtimeThreadStateTracker.ts` | 线程运行态跟踪 |
| `systemChecks.ts` | 环境检测 |
| `ipc/` | IPC 注册与分域 handler |
| `services/` | 更新、远程同步、工作区补丁等服务 |
| `windows/` | 窗口创建与壳层配置 |
| `utils/` | 主进程通用工具 |

## 维护边界

- ✅ 保持“薄入口 + 服务下沉”
- ✅ 系统调用、进程控制、文件写入优先收敛到 service 层
- ❌ 不在窗口层塞业务流程
