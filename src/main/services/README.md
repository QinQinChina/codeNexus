# src/main/services

## 目录用途

主进程服务层，封装进程、文件系统、更新、原生 helper 与本地持久化能力。

## 当前内容

| 文件                            | 说明                          |
| ------------------------------- | ----------------------------- |
| `CodexServerManager.ts`         | app-server 生命周期与请求分发 |
| `HistoryService.ts`             | 历史存取与整理                |
| `LocalSettingsService.ts`       | 本地设置读写                  |
| `WorkspacePatchService.ts`      | patch 预览 / 应用             |
| `UpdateService.ts`              | 自动更新与安装包管理          |
| `CacheRegistryService.ts`       | 主进程缓存统一注册与清理      |
| `ThreadTitleOverrideService.ts` | 线程标题覆盖服务              |
| `ThreadTaskService.ts`          | 线程任务管理                  |
| `ThreadArtifactService.ts`      | 线程产物管理                  |

## 维护边界

- ✅ 对外暴露稳定接口给 handler 层调用
- ✅ 失败路径要显式记录并返回可用错误
