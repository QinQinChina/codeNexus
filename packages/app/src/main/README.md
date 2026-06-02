# packages/app/src/main

## 目录用途

Electron 主进程目录，负责应用生命周期、窗口、Codex app-server 管理、IPC 注册与应用级服务。

功能域专属的历史、任务或设置服务优先留在对应 feature 包；主进程只负责装配它们并提供系统能力。

## 当前内容

| 文件 / 目录                    | 说明                         |
| ------------------------------ | ---------------------------- |
| `main.ts`                      | 主进程入口与服务装配         |
| `codexAppServer.ts`            | Codex app-server 进程封装    |
| `historyStore.ts`              | 应用级历史会话存取           |
| `runtimeThreadStateTracker.ts` | 线程运行态跟踪               |
| `systemChecks.ts`              | 环境检测                     |
| `ipc/`                         | IPC 注册与分域 handler       |
| `services/`                    | 配置、缓存、工作区等壳层服务 |
| `windows/`                     | 窗口创建与壳层配置           |
| `utils/`                       | 主进程通用工具               |

## 维护边界

- ✅ 保持“薄入口 + 服务下沉”
- ✅ 系统调用、进程控制、文件写入优先收敛到 service 层
- ✅ feature 包的主进程能力通过显式导入和 handler 装配接入
- ❌ 不在窗口层塞业务流程
