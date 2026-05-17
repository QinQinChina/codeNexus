<template>
  <div
    class="chat-bubble chat-bubble-user w-full max-w-full min-w-0 cursor-pointer rounded-[4px] border border-[color:var(--bubble-user-border)] bg-[var(--bubble-user-bg)] bg-clip-padding px-3 py-2.5 shadow-[var(--bubble-shadow)]"
  >
    <div class="chat-bubble-inline flex min-w-0 items-start justify-between gap-2.5">
      <div class="chat-bubble-body flex-1 min-w-0 whitespace-pre-wrap break-words">
        <slot />
      </div>
      <span
        class="chat-bubble-meta-right inline-flex flex-none min-w-0 items-center justify-end gap-2.5 whitespace-nowrap"
      >
        <slot name="meta" />
      </span>
    </div>
  </div>
</template>
