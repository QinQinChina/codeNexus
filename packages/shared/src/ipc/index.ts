/*
 * IPC 共享导出入口
 * ─────────────────────────────────────────────────────────────
 * 作用域：Main / Preload / Renderer
 * 模块关系：聚合 channels 与 contracts 两个子模块
 * 用途：各层统一通过此入口引用 IPC 常量与契约类型
 */

// IPC 共享导出：集中导出 channels 与 contracts，供各层按需引用。
export * from "./channels";
export * from "./contracts";

