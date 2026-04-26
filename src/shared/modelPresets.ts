export type ModelPreset = {
  id: string;
  provider: string;
  // 用于提示用户应该配置到 codex cli 的 base_url（不会自动修改配置文件）。
  baseUrlHint?: string;
};

// 国内常用（且通常提供 OpenAI 兼容接口）的模型 id 预设。
// 注意：这些只是“快捷添加 model id”的建议项，是否可用最终取决于你当前 codex CLI 的 provider/base_url 配置与账号权限。
export const CN_MODEL_PRESETS: readonly ModelPreset[] = [
  // DeepSeek
  { provider: "DeepSeek", id: "deepseek-chat", baseUrlHint: "https://api.deepseek.com" },
  { provider: "DeepSeek", id: "deepseek-reasoner", baseUrlHint: "https://api.deepseek.com" },
  { provider: "DeepSeek", id: "deepseek-coder", baseUrlHint: "https://api.deepseek.com" },

  // Moonshot (Kimi)
  { provider: "Moonshot (Kimi)", id: "moonshot-v1-8k", baseUrlHint: "https://api.moonshot.cn/v1" },
  { provider: "Moonshot (Kimi)", id: "moonshot-v1-32k", baseUrlHint: "https://api.moonshot.cn/v1" },
  { provider: "Moonshot (Kimi)", id: "moonshot-v1-128k", baseUrlHint: "https://api.moonshot.cn/v1" },
  { provider: "Moonshot (Kimi)", id: "kimi-latest", baseUrlHint: "https://api.moonshot.cn/v1" },

  // Alibaba Cloud (DashScope / Qwen)
  { provider: "DashScope (Qwen)", id: "qwen-plus", baseUrlHint: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  {
    provider: "DashScope (Qwen)",
    id: "qwen3-coder-plus",
    baseUrlHint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    provider: "DashScope (Qwen)",
    id: "qwen3-coder-flash",
    baseUrlHint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    provider: "DashScope (Qwen)",
    id: "qwen-coder-plus-latest",
    baseUrlHint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    provider: "DashScope (Qwen)",
    id: "qwen-coder-turbo-latest",
    baseUrlHint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },

  // Zhipu AI (BigModel / GLM)
  { provider: "Zhipu (GLM)", id: "glm-5", baseUrlHint: "https://open.bigmodel.cn/api/paas/v4/" },
  { provider: "Zhipu (GLM)", id: "glm-4.7", baseUrlHint: "https://open.bigmodel.cn/api/paas/v4/" },

  // Volcengine Ark (Coding Plan / OpenAI-compatible)
  {
    provider: "Volcengine (Ark Coding Plan)",
    id: "doubao-seed-2.0-code",
    baseUrlHint: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },
  {
    provider: "Volcengine (Ark Coding Plan)",
    id: "doubao-seed-2.0-pro",
    baseUrlHint: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },
  {
    provider: "Volcengine (Ark Coding Plan)",
    id: "doubao-seed-2.0-lite",
    baseUrlHint: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },
  {
    provider: "Volcengine (Ark Coding Plan)",
    id: "doubao-seed-code",
    baseUrlHint: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },
  {
    provider: "Volcengine (Ark Coding Plan)",
    id: "ark-code-latest",
    baseUrlHint: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },
] as const;
