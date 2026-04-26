# src/renderer/styles

## 目录用途

渲染层全局样式目录。

## 导入链路

| 入口 | 说明 |
| --- | --- |
| `src/renderer/main.ts` | 依次导入 `tailwind.css` 与 `styles/index.css` |
| `styles/index.css` | 串联 `foundation -> layout -> timeline -> composer -> responsive` |

## 当前结构

| 目录 / 文件 | 说明 |
| --- | --- |
| `foundation/` | 基础变量、shell、topbar 样式 |
| `layout/` | 左侧栏、中心区、面板、表单等布局样式 |
| `responsive/` | 紧凑布局覆盖 |
| `timeline.css` | 时间线卡片与 diff |
| `composer.css` | 输入区与附件区 |
| `index.css` | 全局样式总入口 |

## 维护边界

- ✅ 新样式优先放入对应模块文件
- ✅ 保持 CSS 变量与导入顺序稳定
- ❌ 不把大块样式重新塞回单文件组件
