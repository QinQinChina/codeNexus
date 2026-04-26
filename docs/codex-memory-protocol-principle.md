# Codex Memory 协议原理与接入说明

## 结论

当前项目接入的是 Codex app-server 在 `0.124.0` 里暴露的实验性 memory 控制协议：

- `thread/memoryMode/set`：设置某个线程是否继续具备“未来生成记忆”的资格，参数是 `{ threadId, mode }`，其中 `mode` 只能是 `enabled` 或 `disabled`。
- `memory/reset`：清理当前 `CODEX_HOME/memories` 目录，并重置 sqlite 中持久化的 memory stage 数据；它不会改变已有线程的 memory mode。

这两个协议控制的是 Codex 自身的长期记忆系统，不等同于本项目里的本地缓存、历史回放缓存、草稿缓存或 UI 状态缓存。

## 工作原理

Codex memory 不是在每次对话里直接写一条“偏好记录”，而是后台异步管线：

1. 根 session 启动时，如果不是 ephemeral session、memory 功能已启用、不是 sub-agent、状态数据库可用，memory pipeline 会在后台运行。
2. 第一阶段按线程读取符合条件的 rollout，从最近的交互线程中抽取结构化 memory。
3. 后续阶段会把抽取结果整理为可复用的长期记忆资料。
4. 新线程启动时，Codex 可以根据这些资料选择相关 memory 放入上下文。

因此：

- `thread/memoryMode/set` 不会立刻删除已有记忆，而是控制该线程后续是否还参与 memory 生成。
- `memory/reset` 会清掉本地 memory 产物和 memory 阶段数据，但保留每个线程已设置的 `enabled/disabled` 模式。
- 如果用户要彻底避免某个线程继续贡献记忆，应先把该线程设为 `disabled`；如果还要清掉已生成的长期记忆，再执行 `memory/reset`。

## 本项目接入方式

本项目现在提供两类入口：

- 右侧栏“上下文操作”：启用当前线程记忆、关闭当前线程记忆、重置 Codex 记忆。
- 顶部工具菜单：提供同样的快捷入口。

调用行为：

- 当前无线程时，`thread/memoryMode/set` 不会发请求，并提示用户先选择线程。
- 当前无 Codex 服务连接时，两个 memory 操作都不会发请求，并显示警告 toast。
- 成功后写入本地 timeline 事件，方便用户回看发生过的 memory 操作。

## 与本地缓存的区别

项目里也有多个名字带 `MemoryCache` 的本地缓存，例如：

- 本地设置内存镜像
- 草稿内存镜像
- 消息 outbox 内存镜像
- workflow 模板内存镜像
- 历史回放/线程内容缓存

这些只是 Electron 应用运行时为了性能和 UI 恢复保存的短期缓存。它们不会影响 Codex app-server 的长期 memory，也不会被 `memory/reset` 直接清理。

## 参考

- Codex app-server README：`thread/memoryMode/set` 与 `memory/reset` 协议说明：<https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>
- Codex memory pipeline README：memory pipeline 触发条件、阶段和模板说明：<https://github.com/openai/codex/blob/main/codex-rs/core/src/memories/README.md>
