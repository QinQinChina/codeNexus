import { onBeforeUnmount, shallowRef } from "vue";
import { getMarkdownRendererVersion, whenMarkdownRendererReady } from "./markdownRenderer";

export function useMarkdownRendererRefresh() {
  const markdownRendererTick = shallowRef(0);
  let disposed = false;
  let pending = false;

  const refreshWhenReady = () => {
    void markdownRendererTick.value;
    if (getMarkdownRendererVersion() > 0) return;
    if (pending) return;
    pending = true;
    void whenMarkdownRendererReady()
      .then(() => {
        pending = false;
        if (!disposed) markdownRendererTick.value += 1;
      })
      .catch(() => {
        pending = false;
      });
  };

  onBeforeUnmount(() => {
    disposed = true;
  });

  return { markdownRendererTick, refreshWhenReady };
}
