# src/renderer/features

## 目录用途

按业务域拆分的渲染层功能模块目录。

## 当前结构

| 目录 | 说明 |
| --- | --- |
| `approval/` | 审批 payload 构造 |
| `context/` | 上下文能力扩展位 |
| `explored/` | 实验功能扩展位 |
| `guardian/` | guardian 评审摘要与诊断 |
| `history/` | 历史回放、标题、handoff 诊断 |
| `notificationSound/` | 通知音播放器 |
| `plan/` | 计划步骤状态归一化 |
| `sleep/` | 睡眠页音频能力 |
| `thread/` | 线程能力扩展位 |
| `timeline/` | 时间线渲染、Markdown、Mermaid、搜索 |
| `translation/` | 翻译能力扩展位 |
| `workflow/` | workflow 执行能力 |

## 维护边界

- ✅ 每个 feature 只聚焦一个业务域
- ✅ 跨域共用逻辑优先下沉到 `shared/` 或 `domain/`
