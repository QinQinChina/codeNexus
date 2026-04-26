import { defineStore } from "pinia";

export const useViewPrefsStore = defineStore("viewPrefs", {
  state: () => ({
    showTimestamps: true,
  }),
  actions: {
    toggleShowTimestamps() {
      this.showTimestamps = !this.showTimestamps;
    },
  },
});
