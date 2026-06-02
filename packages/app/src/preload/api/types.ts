import type {
  CodexDesktopApi as SharedCodexDesktopApi,
  CodexDesktopAppApi as SharedCodexDesktopAppApi,
} from "@codenexus/shared/ipc/contracts";
import type {
  FlowchartAiRunArgs,
  FlowchartAiRunResult,
  FlowchartDocument,
  FlowchartHistoryDeleteResult,
  FlowchartHistoryListResult,
  FlowchartHistoryUpsertResult,
} from "@codenexus/feature-flowchart/types";
import type {
  ImageGenerationGenerateArgs,
  ImageGenerationGenerateResult,
  ImageGenerationHistoryDeleteResult,
  ImageGenerationHistoryListResult,
  ImageGenerationTaskCancelResult,
  ImageGenerationTaskDeleteResult,
  ImageGenerationTaskListResult,
  ImageGenerationTaskRetryResult,
  ImageGenerationTaskSubmitResult,
} from "@codenexus/feature-imagegen/types";

export * from "@codenexus/shared/ipc/contracts";

export type FeatureImageGenerationAppApi = {
  generateImage(args: ImageGenerationGenerateArgs): Promise<ImageGenerationGenerateResult>;
  listImageGenerationHistory(): Promise<ImageGenerationHistoryListResult>;
  deleteImageGenerationHistory(args: { id: string }): Promise<ImageGenerationHistoryDeleteResult>;
  listImageGenerationTasks(): Promise<ImageGenerationTaskListResult>;
  submitImageGenerationTask(args: ImageGenerationGenerateArgs): Promise<ImageGenerationTaskSubmitResult>;
  cancelImageGenerationTask(args: { id: string }): Promise<ImageGenerationTaskCancelResult>;
  deleteImageGenerationTask(args: { id: string }): Promise<ImageGenerationTaskDeleteResult>;
  retryImageGenerationTask(args: { id: string }): Promise<ImageGenerationTaskRetryResult>;
};

export type FeatureFlowchartAppApi = {
  listFlowchartHistory(): Promise<FlowchartHistoryListResult>;
  upsertFlowchartHistory(args: { document: FlowchartDocument }): Promise<FlowchartHistoryUpsertResult>;
  deleteFlowchartHistory(args: { id: string }): Promise<FlowchartHistoryDeleteResult>;
  runFlowchartAi(args: FlowchartAiRunArgs): Promise<FlowchartAiRunResult>;
};

export type CodexDesktopAppApi = SharedCodexDesktopAppApi & FeatureImageGenerationAppApi & FeatureFlowchartAppApi;

export type CodexDesktopApi = Omit<SharedCodexDesktopApi, "app"> & {
  app: CodexDesktopAppApi;
};
