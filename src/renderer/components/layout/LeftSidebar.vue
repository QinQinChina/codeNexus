<template>
  <aside class="sidebar sidebar-left">
    <div class="lsb-shell lsb-shell--threads-only">
      <section class="lsb-pane-frame" data-pane="threads">
        <ThreadHistoryPane />
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import ThreadHistoryPane from "./left-sidebar/ThreadHistoryPane.vue";
</script>

<style scoped></style>
