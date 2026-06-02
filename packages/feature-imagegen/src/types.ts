export type ImageGenerationGenerateArgs = {
  threadId?: string | null;
  turnId?: string | null;
  callId?: string | null;
  workspacePath?: string | null;
  mode?: "generate" | "edit" | null;
  prompt: string;
  inputImages?: Array<{
    dataUrl: string;
    name?: string | null;
  }> | null;
  maskDataUrl?: string | null;
  size?: string | null;
  quality?: string | null;
  outputFormat?: string | null;
  background?: string | null;
  moderation?: string | null;
  outputCompression?: number | null;
  n?: number | null;
};

export type ImageGenerationGeneratedImage = {
  path: string;
  dataUrl: string;
  mimeType: string;
  revisedPrompt: string | null;
};

export type ImageGenerationHistoryImage = {
  path: string;
  mimeType: string;
  revisedPrompt: string | null;
};

export type ImageGenerationHistoryItem = {
  id: string;
  createdAt: number;
  updatedAt: number;
  workspacePath: string | null;
  model: string;
  prompt: string;
  revisedPrompt: string | null;
  mode: "generate" | "edit";
  size: string | null;
  quality: string | null;
  outputFormat: string | null;
  background: string | null;
  moderation: string | null;
  outputCompression: number | null;
  images: ImageGenerationHistoryImage[];
};

export type ImageGenerationGenerateResult = {
  ok: true;
  historyId: string;
  createdAt: number;
  model: string;
  prompt: string;
  revisedPrompt: string | null;
  images: ImageGenerationGeneratedImage[];
};

export type ImageGenerationHistoryListResult = {
  items: ImageGenerationHistoryItem[];
};

export type ImageGenerationHistoryDeleteResult = {
  ok: true;
  deleted: boolean;
  items: ImageGenerationHistoryItem[];
};

export type ImageGenerationTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type ImageGenerationTaskItem = {
  id: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  status: ImageGenerationTaskStatus;
  args: ImageGenerationGenerateArgs;
  historyId: string | null;
  result: ImageGenerationGenerateResult | null;
  errorText: string | null;
  retryOf: string | null;
  attempt: number;
};

export type ImageGenerationTaskListResult = {
  tasks: ImageGenerationTaskItem[];
};

export type ImageGenerationTaskSubmitResult = {
  ok: true;
  task: ImageGenerationTaskItem;
  tasks: ImageGenerationTaskItem[];
};

export type ImageGenerationTaskCancelResult = {
  ok: true;
  canceled: boolean;
  task: ImageGenerationTaskItem | null;
  tasks: ImageGenerationTaskItem[];
};

export type ImageGenerationTaskDeleteResult = {
  ok: true;
  deleted: boolean;
  tasks: ImageGenerationTaskItem[];
};

export type ImageGenerationTaskRetryResult = {
  ok: true;
  task: ImageGenerationTaskItem;
  tasks: ImageGenerationTaskItem[];
};
