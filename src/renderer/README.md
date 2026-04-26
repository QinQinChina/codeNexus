# src/renderer

## 目录用途

渲染层目录，负责 UI、Pinia 状态、运行时编排与协议事件处理。

## 当前结构

| 目录 / 文件 | 说明 |
| --- | --- |
| `main.ts` | 渲染层启动、主题/字体初始化、本地状态 hydrate |
| `App.vue` | 应用骨架，切换 chat / settings / sleep |
| `components/` | 页面组件、布局组件与时间线卡片 |
| `stores/` | Pinia 状态容器 |
| `domain/` | 编排、互操作与本地状态 |
| `features/` | 业务域能力 |
| `processes/` | 事件流水线与请求响应流程 |
| `api/` / `infra/` | IPC 与桌面 API 适配 |
| `styles/` / `theme/` / `tailwind.css` | 全局样式与主题层 |

## 维护边界

- ✅ 保持 `事件 -> 状态 -> 视图` 的单向流
- ✅ 协议处理与 UI 展示分层维护
- ❌ 不让组件层直接承担协议编排
