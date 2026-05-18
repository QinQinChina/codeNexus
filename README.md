# CodeNexus

`CodeNexus` 是一个面向 Windows 的非官方 Codex 桌面 GUI，基于 `Electron + Vue 3 + Pinia + codex app-server`。

## 项目定位

| 项目     | 说明                                                               |
| -------- | ------------------------------------------------------------------ |
| 产品形态 | ✅ Windows 桌面端 Codex GUI                                        |
| 当前定位 | ✅ 线程对话、时间线、工作区、Settings（Workspace Team 模式已下线） |
| 技术栈   | `Electron`、`Vue 3`、`Pinia`、`TypeScript`                         |
| 官方属性 | ❌ 不是 OpenAI 官方产品                                            |
| 平台支持 | ✅ 仅支持 Windows 10/11                                            |

## 当前能力

| 能力           | 说明                                                                |
| -------------- | ------------------------------------------------------------------- |
| 会话与时间线   | 启动线程、发送回合、查看协议事件、文件变更与 diff                   |
| 工作区与编辑器 | 浏览工作区文件、多标签编辑、工作区拖拽与保存                        |
| Settings       | 全局配置、提示音、环境检测、Skills / MCP、应用更新                  |
| Workflow       | 已下线：多角色工作流与团队画布入口已停用                            |
| 审批与诊断     | 处理 command / apply_patch / permissions 审批，并展示 guardian 诊断 |
| 扩展能力       | Skills、MCP、MCP 资源读取、OAuth、工具元数据诊断                    |
| 辅助能力       | 历史回放、主题切换、字体设置、通知音、自动更新                      |

## 环境要求

| 项目      | 要求                                       |
| --------- | ------------------------------------------ |
| 操作系统  | Windows 10/11                              |
| Node.js   | 建议 LTS                                   |
| 包管理器  | `pnpm@10`                                  |
| Codex CLI | 当前协议生成基线为 `@openai/codex@0.130.0` |

建议先确认本机可直接运行：

```powershell
npm i -g @openai/codex@0.130.0
codex --version
```

## 本地开发

```powershell
pnpm install
pnpm run dev
```

## 构建与发布

| 命令             | 说明                           |
| ---------------- | ------------------------------ |
| `pnpm run build` | 构建 renderer / main / preload |
| `pnpm run dist`  | 生成 Electron 安装包           |

## 协议类型更新

当前仓库保留了 `codex:types` 脚本，默认将 generated 类型输出到临时目录后再手动比对：

```powershell
pnpm run codex:types
pnpm run typecheck
```

## 目录结构

| 目录            | 说明                                 |
| --------------- | ------------------------------------ |
| `src/main`      | Electron 主进程、窗口、IPC、服务编排 |
| `src/preload`   | `contextBridge` 安全桥接层           |
| `src/renderer`  | Vue 界面、Pinia 状态、运行时编排     |
| `src/shared`    | 跨进程共享契约与协议类型             |
| `scripts`       | 开发、构建、图标、发布脚本           |
| `src/README.md` | 应用功能文档入口                     |

## 边界说明

- ✅ 仓库包含当前项目需要的界面代码、构建脚本与少量原生辅助程序
- ✅ 应用窗口标题、图标与安装包名已切换到 `CodeNexus`
- ✅ 字体、图标与内置提示音等二进制资源授权状态见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- ❌ 仓库不提供 OpenAI 账号、Token 或托管服务
- ❌ 运行本项目产生的模型调用费用与本地数据安全责任由使用者自行承担

## License

MIT，见 [LICENSE](LICENSE)。
