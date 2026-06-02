# src

## 目录用途

项目源码根目录，按 `main / preload / renderer / shared` 四层组织，同时保留 `generated` 协议类型产物。

## 当前结构

| 目录         | 说明                                          |
| ------------ | --------------------------------------------- |
| `generated/` | `codex app-server` 生成的 TypeScript 协议类型 |
| `main/`      | Electron 主进程、窗口、IPC、服务              |
| `preload/`   | `contextBridge` 桥接与 IPC 客户端             |
| `renderer/`  | Vue UI、状态、流程编排、业务模块              |
| `shared/`    | 主渲染共用类型与 IPC 契约                     |

## 维护边界

- ✅ 跨层通信统一经由 IPC 与 `window.codexDesktop`
- ✅ 协议升级优先更新 `generated/` 与 `shared/codex-protocol`
- ❌ 不要把渲染层业务逻辑塞回 `main/` 或 `preload/`

## 维护建议

- ✅ 新增能力前先确认层级归属
- ✅ 分层职责变化时同步更新对应子目录 `README.md`
