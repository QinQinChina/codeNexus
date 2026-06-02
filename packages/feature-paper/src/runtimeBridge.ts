type PaperToastKind = "success" | "error" | "warn" | "info";

export function showPaperToast(options: { kind?: PaperToastKind; title?: string; message: string }): void {
  window.dispatchEvent(new CustomEvent("codenexus:toast", { detail: options }));
}