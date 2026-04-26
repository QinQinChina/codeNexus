# Remote Sync Phase 1（桌面 -> 服务器 -> Android）

## 目标

Phase 1 只做远程**只读查看**：

- 桌面端周期上报线程状态与计划
- 手机端查看运行状态和最近事件
- 不做远程控制

## 目录

- 桌面端：`src/main/services/RemoteStateSyncService.ts`
- 后端：`server/`
- Android：`android/remote_monitor/`

## 数据流

1. 桌面端登录后拿到 `accessToken/refreshToken`
2. 桌面端绑定 `desktopId`
3. 桌面端上报事件队列（`turnStarted/turnCompleted/planUpdated`）
4. 桌面端上报线程快照（当前线程运行状态、计划）
5. Android 建立 `WebSocket` 实时通道（握手带 Bearer）
6. Android 使用同一账号读取 `overview` 和 `thread detail` 作为兜底

## 后端接口

### 认证

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`

### 桌面写入

- `POST /api/v1/desktop/bind`
- `POST /api/v1/ingest/events`
- `POST /api/v1/ingest/snapshot`

### 手机读取

- `GET /api/v1/mobile/overview`
- `GET /api/v1/mobile/threads/{threadId}`

### 手机实时推送

- `GET /ws/mobile/realtime`（握手：`Authorization: Bearer <accessToken>`）
- 推送 envelope：`type + serverTs + payload`
- 推送类型：`snapshot.full`、`summary.update`、`thread.upsert`、`thread.delete`、`event.append`

## 实时与兜底策略

- 桌面上行保持 HTTP ingest，不改协议。
- 手机端优先 WebSocket 增量推送。
- WebSocket 未连接时自动降级轮询：概览 15s，详情 10s。
- WebSocket 重连后通过 `snapshot.full` 全量重建，不做事件补发。

## 约束

- 用户与桌面：Phase 1 按 **1 用户 -> 1 桌面** 绑定。
- 手机端：只读，不下发命令。
- 鉴权：除 `/auth/*` 之外都要求 Bearer Token。

## 启动顺序建议

1. 启动 MySQL / Redis
2. 启动 `server`（默认 `18080`）
3. 桌面端设置页配置远程同步并登录
4. 启动 Android Flutter App 登录并查看
