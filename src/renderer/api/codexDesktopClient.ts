import { type CodexDesktopApi } from "../../shared/ipc";

// 渲染层统一通过 preload 注入的全局对象访问桌面能力。
// 这里保持单例导出，避免在各模块重复访问 `window.codexDesktop`。
export const codexDesktop: CodexDesktopApi = window.codexDesktop;
